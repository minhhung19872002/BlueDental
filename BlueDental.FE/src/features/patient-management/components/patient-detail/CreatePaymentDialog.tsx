import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Button, Checkbox, Input, Modal } from "antd";
import {
  AccountBookOutlined,
  BankOutlined,
  CreditCardOutlined,
  DollarOutlined,
  FileTextOutlined,
  InfoCircleOutlined,
  ProfileOutlined,
  SaveOutlined,
  SearchOutlined,
  WalletOutlined,
} from "@ant-design/icons";
import { toast } from "sonner";
import { CurrencyInput } from "@/components/CurrencyInput";
import { FloatingLabel } from "@/components/FloatingLabel";
import { useAuthStore } from "@/features/auth/store/authStore";
import {
  PAYMENT_ACCOUNT_KIND,
  usePaymentAccountOptions,
  type PaymentAccountKindCode,
} from "@/hooks/usePaymentAccountOptions";
import { extractApiError } from "@/lib/apiError";
import { t } from "@/lib/i18n";
import { formatDate, formatMoneyUnit } from "@/utils/format";
import {
  PAYMENT_KIND,
  PAYMENT_METHOD,
  PAYMENT_METHOD_ORDER,
  SPLIT_MODE,
  paymentMethodLabels,
  useRecordPayment,
  type PaymentMethodKind,
  type TreatmentPlanSlipDto,
  type TreatmentServiceDto,
} from "@/features/treatment-management/api/treatmentPlanApi";
import "./patient-detail.css";

interface Props {
  open: boolean;
  patientId: string;
  branchId: string;
  /** The slip the clicked row belongs to; its lines are what can be paid. */
  plan: TreatmentPlanSlipDto | null;
  /** The row that was clicked — ticked when the dialog opens. */
  focusServiceId: string | null;
  /** Dư nợ — money the clinic already holds for the patient. */
  heldForPatient: number;
  onClose: () => void;
  onSaved: () => void;
}

/** Chia Tiền Tự Động / Chia Tiền Thủ Công. */
type SplitMode = "auto" | "manual";

const METHOD_ICONS: Record<PaymentMethodKind, ReactNode> = {
  [PAYMENT_METHOD.Cash]: <DollarOutlined />,
  [PAYMENT_METHOD.Banking]: <BankOutlined />,
  [PAYMENT_METHOD.EWallet]: <WalletOutlined />,
  [PAYMENT_METHOD.Card]: <CreditCardOutlined />,
  [PAYMENT_METHOD.OutstandingDebt]: <AccountBookOutlined />,
};

const NOTE_LIMIT = 500;

/**
 * Ngân hàng and Ví momo collect into one of the clinic's accounts, and the
 * reference refuses to save until one is picked. Cash, card and Dư nợ do not.
 */
const ACCOUNT_KIND_BY_METHOD: Partial<Record<PaymentMethodKind, PaymentAccountKindCode>> = {
  [PAYMENT_METHOD.Banking]: PAYMENT_ACCOUNT_KIND.Bank,
  [PAYMENT_METHOD.EWallet]: PAYMENT_ACCOUNT_KIND.MoMo,
};

/** One "Nội dung — value" line of the two fact blocks. */
function Fact({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="pd-newpay-fact">
      <span>{label}</span>
      <span className={strong ? "pd-newpay-strong" : undefined}>{value}</span>
    </div>
  );
}

/**
 * "Tạo phiếu thanh toán" — the dialog behind a treatment row's Thao tác.
 *
 * Laid out from the reference's own dialog (1024px, two columns). Every line
 * the money is split across is recorded as its own payment naming that line, so
 * the row's Còn nợ moves rather than only the slip's rollup.
 */
export function CreatePaymentDialog({
  open,
  patientId,
  branchId,
  plan,
  focusServiceId,
  heldForPatient,
  onClose,
  onSaved,
}: Props) {
  const staffId = useAuthStore((state) => state.user?.id) ?? "";
  const record = useRecordPayment();

  const [picked, setPicked] = useState<string[]>([]);
  const [mode, setMode] = useState<SplitMode>("auto");
  const [amount, setAmount] = useState<number>();
  const [manual, setManual] = useState<Record<string, number | undefined>>({});
  const [method, setMethod] = useState<PaymentMethodKind>(PAYMENT_METHOD.Cash);
  const [note, setNote] = useState("");
  const [accountId, setAccountId] = useState<string>();
  const [searching, setSearching] = useState(false);
  const [keyword, setKeyword] = useState("");

  // Only lines that still owe something can be paid; a settled one has nothing
  // for the dialog to collect.
  const lines = useMemo(
    () => (plan?.services ?? []).filter((line) => line.outstandingAmount > 0),
    [plan],
  );
  const visible = useMemo(() => {
    const needle = keyword.trim().toLocaleLowerCase("vi");
    if (!needle) return lines;
    return lines.filter((line) =>
      (line.serviceName ?? line.code).toLocaleLowerCase("vi").includes(needle),
    );
  }, [keyword, lines]);

  useEffect(() => {
    if (!open) return;
    const focused = lines.find((line) => line.id === focusServiceId);
    setPicked(focused ? [focused.id] : []);
    setMode("auto");
    setAmount(undefined);
    setManual({});
    setMethod(PAYMENT_METHOD.Cash);
    setAccountId(undefined);
    setNote("");
    setSearching(false);
    setKeyword("");
  }, [open, focusServiceId, lines]);

  const chosen = lines.filter((line) => picked.includes(line.id));
  const chosenDue = chosen.reduce((sum, line) => sum + line.outstandingAmount, 0);
  /** A box the user has not touched offers the whole of what that line owes. */
  const shareOf = (line: TreatmentServiceDto) =>
    manual[line.id] === undefined ? line.outstandingAmount : manual[line.id];
  const manualTotal = chosen.reduce((sum, line) => sum + (shareOf(line) ?? 0), 0);

  const planDue = plan ? plan.payment.totalDue : 0;
  const noService = chosen.length === 0;

  const accountKind = ACCOUNT_KIND_BY_METHOD[method] ?? null;
  const accounts = usePaymentAccountOptions(branchId, accountKind).data ?? [];
  const needsAccount = accountKind !== null;
  const missingAccount = needsAccount && !accountId;

  /**
   * What Tự động offers before anything is typed — the reference prefills the
   * box with the whole of what is owed, and caps Dư nợ at the balance actually
   * being held for the patient.
   */
  const autoDefault =
    method === PAYMENT_METHOD.OutstandingDebt
      ? Math.min(Math.max(heldForPatient, 0), Math.max(chosenDue, 0))
      : Math.max(chosenDue, 0);
  const autoAmount = amount ?? autoDefault;
  const total = mode === "auto" ? autoAmount : manualTotal;
  const overpaid = total > chosenDue;

  const toggle = (id: string, on: boolean) =>
    setPicked((current) => (on ? [...current, id] : current.filter((x) => x !== id)));

  const toggleAll = (on: boolean) => setPicked(on ? lines.map((line) => line.id) : []);

  const save = async () => {
    if (!plan || noService) return;

    if (total <= 0) {
      toast.error(t("Vui lòng nhập số tiền thanh toán"));
      return;
    }
    if (overpaid) {
      toast.error(
        t("Số tiền thanh toán không được vượt quá số tiền còn phải thanh toán"),
      );
      return;
    }
    if (missingAccount) {
      toast.error(t("Vui lòng chọn phương thức thanh toán"));
      return;
    }

    try {
      // One receipt naming every chosen service, as the reference posts it.
      // Tự động leaves the split to the server, which is the only side that
      // knows what each line still owes.
      await record.mutateAsync({
        patientId,
        clinicBranchId: branchId,
        treatmentPlanId: plan.id,
        treatmentServiceIds: chosen.map((line) => line.id),
        splitMode: mode === "auto" ? SPLIT_MODE.Auto : SPLIT_MODE.Manual,
        items:
          mode === "manual"
            ? chosen
                .map((line) => ({
                  treatmentServiceId: line.id,
                  amount: shareOf(line) ?? 0,
                }))
                .filter((item) => item.amount > 0)
            : undefined,
        kind: PAYMENT_KIND.Payment,
        method,
        amount: total,
        staffId,
        note: note.trim() || undefined,
        paymentAccountId: needsAccount ? accountId : undefined,
      });

      toast.success(t("Đã tạo phiếu thanh toán"));
      onSaved();
      onClose();
    } catch (error) {
      toast.error(extractApiError(error));
    }
  };

  const methodLabels = paymentMethodLabels();
  const today = formatDate(new Date().toISOString());

  return (
    <Modal
      open={open}
      // 1024px, measured off the reference's own dialog.
      width="min(1024px, calc(100vw - 48px))"
      className="pd-newpay-dialog"
      title={t("Tạo phiếu thanh toán")}
      onCancel={onClose}
      destroyOnHidden
      footer={
        <div className="pd-newpay-footer">
          <p>
            <InfoCircleOutlined />{" "}
            {t("Phiếu thanh toán chỉ có thể chỉnh sửa trong vòng 7 ngày kể từ ngày tạo.")}
          </p>
          <Button
            type="primary"
            icon={<SaveOutlined />}
            loading={record.isPending}
            disabled={record.isPending}
            onClick={() => void save()}
          >
            {t("Lưu")}
          </Button>
        </div>
      }
    >
      <div className="pd-newpay-grid">
        <div className="pd-newpay-col">
          <section>
            <h4 className="pd-newpay-head">
              <FileTextOutlined /> {t("Nội dung thanh toán")}
            </h4>
            <Fact label={t("Nội dung")} value={t("Thanh toán điều trị ngày {0}", today)} />
            <Fact label={t("Ngày thanh toán")} value={today} />
          </section>

          <section>
            <h4 className="pd-newpay-head pd-newpay-head--split">
              <span>
                <FileTextOutlined /> {t("Dịch vụ")}
                <Button
                  type="text"
                  className="pd-newpay-search"
                  icon={<SearchOutlined />}
                  aria-label={t("Tìm dịch vụ")}
                  aria-expanded={searching}
                  onClick={() => setSearching((on) => !on)}
                />
              </span>
              <Checkbox
                checked={lines.length > 0 && picked.length === lines.length}
                indeterminate={picked.length > 0 && picked.length < lines.length}
                disabled={lines.length === 0}
                onChange={(event) => toggleAll(event.target.checked)}
              >
                {t("Chọn Tất Cả")}
              </Checkbox>
            </h4>

            {searching ? (
              <Input
                autoFocus
                allowClear
                value={keyword}
                prefix={<SearchOutlined />}
                className="pd-newpay-searchbox"
                placeholder={t("Tìm dịch vụ")}
                onChange={(event) => setKeyword(event.target.value)}
              />
            ) : null}

            {lines.length === 0 ? (
              <p className="pd-newpay-empty">{t("Phiếu này không còn dịch vụ nào cần thu")}</p>
            ) : (
              <ul className="pd-newpay-lines">
                {visible.map((line) => (
                  <li key={line.id}>
                    <Checkbox
                      checked={picked.includes(line.id)}
                      onChange={(event) => toggle(line.id, event.target.checked)}
                    >
                      <span className="pd-newpay-name">{line.serviceName ?? line.code}</span>
                      <span className="pd-newpay-due">
                        {t("Còn nợ")} {formatMoneyUnit(line.outstandingAmount)}
                      </span>
                      <span className="pd-newpay-qty">
                        {t("Số lượng")}: {line.quantity}
                      </span>
                    </Checkbox>
                    <b>{formatMoneyUnit(line.effectiveAmount)}</b>
                  </li>
                ))}
              </ul>
            )}
            {noService ? (
              <p className="pd-newpay-error">{t("Bạn cần chọn ít nhất 1 dịch vụ")}</p>
            ) : null}
          </section>

          <section>
            <h4 className="pd-newpay-head">
              <ProfileOutlined /> {t("Tổng tiền theo kế hoạch")}
            </h4>
            <Fact label={t("Tổng tiền")} value={formatMoneyUnit(plan?.servicesTotal ?? 0)} />
            <Fact label={t("Giảm giá")} value={formatMoneyUnit(plan?.planDiscountAmount ?? 0)} />
            <Fact label={t("Tổng tiền sau giảm")} value={formatMoneyUnit(plan?.totalAmount ?? 0)} />
            <Fact
              label={t("Đã thanh toán")}
              value={formatMoneyUnit(plan?.payment.totalPaid ?? 0)}
            />
            {/* Live, as the reference computes it: what is left after the amount
                being entered, not what is stored. */}
            <Fact label={t("Còn lại")} value={formatMoneyUnit(planDue - total)} strong />
          </section>
        </div>

        <div className="pd-newpay-col pd-newpay-col--right">
          <section>
            <h4 className="pd-newpay-head">
              <DollarOutlined /> {t("Thông tin thanh toán")}
            </h4>
            <div className="pd-newpay-modes">
              {(
                [
                  ["auto", t("Chia Tiền Tự Động")],
                  ["manual", t("Chia Tiền Thủ Công")],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className={mode === key ? "active" : undefined}>
                  <input
                    type="radio"
                    name="pd-split-mode"
                    checked={mode === key}
                    onChange={() => setMode(key)}
                  />
                  <span className="pd-newpay-radio" />
                  {label}
                </label>
              ))}
            </div>

            {mode === "auto" ? (
              <FloatingLabel label={t("Số tiền thanh toán")} floated>
                <CurrencyInput
                  className="pd-newpay-amount"
                  value={autoAmount}
                  onChange={setAmount}
                />
              </FloatingLabel>
            ) : (
              <div className="pd-newpay-manual">
                {chosen.length === 0 ? (
                  <p className="pd-newpay-empty">{t("Chọn dịch vụ để nhập số tiền")}</p>
                ) : (
                  chosen.map((line) => (
                    <div key={line.id}>
                      <span>{line.serviceName ?? line.code}</span>
                      <CurrencyInput
                        value={shareOf(line)}
                        onChange={(value) =>
                          setManual((current) => ({ ...current, [line.id]: value }))
                        }
                      />
                    </div>
                  ))
                )}
              </div>
            )}

            <div className="pd-newpay-notewrap">
              <FloatingLabel label={t("Ghi chú")} floated={note.length > 0}>
                <Input.TextArea
                  value={note}
                  rows={3}
                  maxLength={NOTE_LIMIT}
                  onChange={(event) => setNote(event.target.value)}
                />
              </FloatingLabel>
              <small>
                {note.length}/{NOTE_LIMIT}
              </small>
            </div>
          </section>

          <section>
            <h4 className="pd-newpay-head">
              <CreditCardOutlined /> {t("Phương thức thanh toán")}
            </h4>
            <div className="pd-newpay-methods">
              {PAYMENT_METHOD_ORDER.map((kind) => (
                <button
                  type="button"
                  key={kind}
                  className={method === kind ? "active" : undefined}
                  onClick={() => {
                    setMethod(kind);
                    setAccountId(undefined);
                  }}
                >
                  <i>{METHOD_ICONS[kind]}</i>
                  {methodLabels[kind]}
                  {kind === PAYMENT_METHOD.OutstandingDebt ? (
                    <em>{formatMoneyUnit(heldForPatient)}</em>
                  ) : null}
                </button>
              ))}
            </div>
            {needsAccount ? (
              <div className="pd-newpay-accounts">
                <div className="pd-newpay-acchead">
                  <span>{t("Chọn")}</span>
                  <span>
                    {accountKind === PAYMENT_ACCOUNT_KIND.Bank
                      ? t("Tên ngân hàng")
                      : t("Số điện thoại")}
                  </span>
                  <span>
                    {accountKind === PAYMENT_ACCOUNT_KIND.Bank
                      ? t("Số tài khoản")
                      : t("Tên chủ tài khoản")}
                  </span>
                </div>
                {accounts.length === 0 ? (
                  <p className="pd-newpay-empty">
                    {accountKind === PAYMENT_ACCOUNT_KIND.Bank
                      ? t("Không có phương thức ngân hàng")
                      : t("Không có phương thức MoMo")}
                  </p>
                ) : (
                  accounts.map((account) => (
                    <label className="pd-newpay-accrow" key={account.id}>
                      <input
                        type="radio"
                        name="pd-payment-account"
                        checked={accountId === account.id}
                        onChange={() => setAccountId(account.id)}
                      />
                      <span className="pd-newpay-radio" />
                      <span>
                        {accountKind === PAYMENT_ACCOUNT_KIND.Bank
                          ? (account.bankName ?? "—")
                          : (account.phoneNumber ?? "—")}
                      </span>
                      <span>
                        {accountKind === PAYMENT_ACCOUNT_KIND.Bank
                          ? (account.accountNumber ?? "—")
                          : account.holderName}
                      </span>
                    </label>
                  ))
                )}
              </div>
            ) : null}
            {overpaid ? (
              <p className="pd-newpay-error">
                {t("Số tiền thanh toán không được vượt quá số tiền còn phải thanh toán")}
              </p>
            ) : null}
          </section>
        </div>
      </div>
    </Modal>
  );
}
