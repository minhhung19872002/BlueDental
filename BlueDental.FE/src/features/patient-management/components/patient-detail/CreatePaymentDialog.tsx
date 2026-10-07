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
  CheckCircleOutlined,
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
import { notifyError } from "@/lib/notify";
import { t } from "@/lib/i18n";
import { formatDate, formatMoneyUnit } from "@/utils/format";
import {
  PAYMENT_KIND,
  PAYMENT_METHOD,
  PAYMENT_METHOD_ORDER,
  SPLIT_MODE,
  paymentMethodLabels,
  useConfirmPayment,
  useRecordPayment,
  useUpdatePayment,
  type PatientPaymentDto,
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
  /**
   * A "Chưa thanh toán" receipt reopened from its row: "edit" saves the
   * dialog's figures, "confirm" saves them and settles the receipt (BA
   * 2026-10-08). Left out, the dialog writes a new receipt.
   */
  revision?: PaymentRevision | null;
  onClose: () => void;
  onSaved: () => void;
}

export interface PaymentRevision {
  payment: PatientPaymentDto;
  action: "edit" | "confirm";
}

const TITLE_KEYS = {
  create: "Patient:Payment:CreateTitle",
  edit: "Treatment:Payment:EditPayment",
  confirm: "Treatment:Payment:ConfirmPayment",
} as const;

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
  revision = null,
  onClose,
  onSaved,
}: Props) {
  const staffId = useAuthStore((state) => state.user?.id) ?? "";
  const record = useRecordPayment();
  const update = useUpdatePayment();
  const confirm = useConfirmPayment();
  const intent = revision?.action ?? "create";
  const saving = record.isPending || update.isPending || confirm.isPending;

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
  // for the dialog to collect. A receipt being reopened keeps its own lines in
  // view even when another receipt has since settled them, so they can be unticked.
  const lines = useMemo(() => {
    const onReceipt = new Set(revision?.payment.lines.map((line) => line.treatmentServiceId));
    return (plan?.services ?? []).filter((line) => line.outstandingAmount > 0 || onReceipt.has(line.id));
  }, [plan, revision]);
  const visible = useMemo(() => {
    const needle = keyword.trim().toLocaleLowerCase("vi");
    if (!needle) return lines;
    return lines.filter((line) =>
      (line.serviceName ?? line.code).toLocaleLowerCase("vi").includes(needle),
    );
  }, [keyword, lines]);

  useEffect(() => {
    if (!open) return;
    setSearching(false);
    setKeyword("");
    const payment = revision?.payment;
    if (payment) {
      // The receipt as it was written; a pending one counts nowhere, so every
      // line's Còn nợ is still the whole of what it owes.
      setPicked(payment.lines.map((line) => line.treatmentServiceId));
      setMode(payment.splitMode === SPLIT_MODE.Manual ? "manual" : "auto");
      setAmount(payment.amount);
      setManual(Object.fromEntries(payment.lines.map((line) => [line.treatmentServiceId, line.amount])));
      setMethod(payment.method);
      setAccountId(payment.paymentAccountId ?? undefined);
      setNote(payment.note ?? "");
      return;
    }
    const focused = lines.find((line) => line.id === focusServiceId);
    setPicked(focused ? [focused.id] : []);
    setMode("auto");
    setAmount(undefined);
    setManual({});
    setMethod(PAYMENT_METHOD.Cash);
    setAccountId(undefined);
    setNote("");
  }, [open, focusServiceId, lines, revision]);

  const chosen = lines.filter((line) => picked.includes(line.id));
  const chosenDue = chosen.reduce((sum, line) => sum + line.outstandingAmount, 0);
  /**
   * A box the user has not touched offers the whole of what that line owes,
   * and no box may take more than that (bug list item 24: a receipt above
   * what is owed left the clinic owing the patient).
   */
  const shareOf = (line: TreatmentServiceDto) =>
    manual[line.id] === undefined
      ? line.outstandingAmount
      : Math.min(manual[line.id] ?? 0, line.outstandingAmount);
  const manualTotal = chosen.reduce((sum, line) => sum + (shareOf(line) ?? 0), 0);

  /** What the slip still owes altogether — the reference's "Còn lại". */
  const planDue = plan ? plan.payment.debt : 0;
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
  /**
   * That default is also the ceiling: the receipt can never collect more than
   * the ticked services still owe, VAT included (bug list item 24). Unticking
   * a service lowers it, and a figure typed earlier follows it down.
   */
  const autoAmount = amount === undefined ? autoDefault : Math.min(amount, autoDefault);
  const total = mode === "auto" ? autoAmount : manualTotal;
  /**
   * Only meaningful once a line is ticked — with nothing chosen the cap is 0
   * and every typed amount would read as "over", which sat beside "Bạn cần
   * chọn ít nhất 1 dịch vụ" and looked like a second, unrelated refusal
   * (R-588). The missing service is the one thing to fix then.
   */
  const overpaid = !noService && total > chosenDue;

  const toggle = (id: string, on: boolean) =>
    setPicked((current) => (on ? [...current, id] : current.filter((x) => x !== id)));

  const toggleAll = (on: boolean) => setPicked(on ? lines.map((line) => line.id) : []);

  const save = async () => {
    if (!plan || noService) return;

    if (total <= 0) {
      toast.error(t("Patient:Payment:EnterAmount"));
      return;
    }
    if (overpaid) {
      toast.error(t("Patient:Payment:AmountExceedsBalance"));
      return;
    }
    if (missingAccount) {
      toast.error(t("Patient:Payment:SelectMethod"));
      return;
    }

    // One receipt naming every chosen service, as the reference posts it.
    // Tự động leaves the split to the server, which is the only side that
    // knows what each line still owes.
    const figures = {
      treatmentServiceIds: chosen.map((line) => line.id),
      splitMode: mode === "auto" ? SPLIT_MODE.Auto : SPLIT_MODE.Manual,
      items:
        mode === "manual"
          ? chosen
              .map((line) => ({ treatmentServiceId: line.id, amount: shareOf(line) ?? 0 }))
              .filter((item) => item.amount > 0)
          : [],
      method,
      amount: total,
    };
    const trimmedNote = note.trim() || undefined;
    const account = needsAccount ? accountId : undefined;

    try {
      if (revision) {
        const body = { id: revision.payment.id, ...figures, note: trimmedNote ?? null, paymentAccountId: account ?? null };
        const confirming = revision.action === "confirm";
        await (confirming ? confirm : update).mutateAsync(body);
        toast.success(t(confirming ? "Treatment:Payment:ConfirmSuccess" : "Treatment:Payment:UpdateSuccess"));
      } else {
        await record.mutateAsync({
          ...figures,
          patientId,
          clinicBranchId: branchId,
          treatmentPlanId: plan.id,
          kind: PAYMENT_KIND.Payment,
          staffId,
          note: trimmedNote,
          paymentAccountId: account,
        });
        toast.success(t("Patient:Payment:CreateSuccess"));
      }
      onSaved();
      onClose();
    } catch (error) {
      notifyError(extractApiError(error));
    }
  };

  const methodLabels = paymentMethodLabels();
  // A reopened receipt keeps the day it was written ("Ngày tạo").
  const today = formatDate(revision?.payment.creationTime ?? new Date().toISOString());

  return (
    <Modal
      open={open}
      // 1024px, measured off the reference's own dialog.
      width="min(1024px, calc(100vw - 48px))"
      className="pd-newpay-dialog"
      title={t(TITLE_KEYS[intent])}
      onCancel={onClose}
      destroyOnHidden
      footer={
        <div className="pd-newpay-footer">
          <p>
            <InfoCircleOutlined />{" "}
            {t("Patient:Payment:EditWarning")}
          </p>
          <Button
            type="primary"
            icon={intent === "confirm" ? <CheckCircleOutlined /> : <SaveOutlined />}
            loading={saving}
            disabled={saving}
            onClick={() => void save()}
          >
            {intent === "confirm" ? t("Treatment:Payment:ConfirmPayment") : t("Common:Save")}
          </Button>
        </div>
      }
    >
      <div className="pd-newpay-grid">
        <div className="pd-newpay-col">
          <section>
            <h4 className="pd-newpay-head">
              <FileTextOutlined /> {t("Patient:Payment:SummaryHeader")}
            </h4>
            <Fact label={t("Patient:Payment:Description")} value={t("Patient:Payment:DefaultDescription", today)} />
            <Fact label={t("Patient:Payment:DateLabel")} value={today} />
          </section>

          <section>
            <h4 className="pd-newpay-head pd-newpay-head--split">
              <span>
                <FileTextOutlined /> {t("Patient:Payment:ServiceHeader")}
                <Button
                  type="text"
                  className="pd-newpay-search"
                  icon={<SearchOutlined />}
                  aria-label={t("Patient:Payment:SearchService")}
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
                {t("Patient:Payment:SelectAll")}
              </Checkbox>
            </h4>

            {searching ? (
              <Input
                autoFocus
                allowClear
                value={keyword}
                prefix={<SearchOutlined />}
                className="pd-newpay-searchbox"
                placeholder={t("Patient:Payment:SearchService")}
                onChange={(event) => setKeyword(event.target.value)}
              />
            ) : null}

            {lines.length === 0 ? (
              <p className="pd-newpay-empty">{t("Patient:Payment:NoServices")}</p>
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
                        {t("Patient:Payment:Outstanding")} {formatMoneyUnit(line.outstandingAmount)}
                      </span>
                      <span className="pd-newpay-qty">
                        {t("Common:Quantity")}: {line.quantity}
                      </span>
                      {line.taxAmount > 0 ? (
                        <span className="pd-newpay-qty">
                          {t("Patient:Payment:IncludesVat", line.taxPercent, formatMoneyUnit(line.taxAmount))}
                        </span>
                      ) : null}
                    </Checkbox>
                    {/* The line before VAT — after the slip discount and voucher —
                        so the price reads as the price; its VAT sits under it and
                        is added in the plan totals below. Còn nợ stays VAT included,
                        as it is what the receipt collects. */}
                    <b>{formatMoneyUnit(line.chargedAmount)}</b>
                  </li>
                ))}
              </ul>
            )}
            {noService ? (
              <p className="pd-newpay-error">{t("Patient:Payment:SelectMinOne")}</p>
            ) : null}
          </section>

          <section>
            <h4 className="pd-newpay-head">
              <ProfileOutlined /> {t("Patient:Payment:PlanTotal")}
            </h4>
            {/* Gross prices and EVERY discount, the lines' own included, so a
                250.000 line discounted by 50.000 reads 250.000 / 50.000 / 200.000
                rather than 200.000 / 0 / 200.000 (R-586). */}
            <Fact label={t("Patient:Payment:Total")} value={formatMoneyUnit(plan?.servicesGrossTotal ?? 0)} />
            <Fact label={t("Common:Discount")} value={formatMoneyUnit(plan?.totalDiscountAmount ?? 0)} />
            <Fact label={t("Patient:Payment:TotalAfterDiscount")} value={formatMoneyUnit(plan?.totalAmount ?? 0)} />
            {/* The services' VAT (bug list item 15): shown only when a line carries
                one, so a slip of KCT services reads as it always has. */}
            {plan && plan.taxAmount > 0 ? (
              <>
                <Fact label={t("Patient:Payment:Vat")} value={formatMoneyUnit(plan.taxAmount)} />
                <Fact label={t("Patient:Payment:TotalWithVat")} value={formatMoneyUnit(plan.payableAmount)} />
              </>
            ) : null}
            <Fact
              label={t("Patient:Payment:Paid")}
              value={formatMoneyUnit(plan?.payment.totalPaid ?? 0)}
            />
            {/* Live, as the reference computes it: what is left after the amount
                being entered, not what is stored. */}
            <Fact label={t("Patient:Payment:Remaining")} value={formatMoneyUnit(planDue - total)} strong />
          </section>
        </div>

        <div className="pd-newpay-col pd-newpay-col--right">
          <section>
            <h4 className="pd-newpay-head">
              <DollarOutlined /> {t("Patient:Payment:InfoHeader")}
            </h4>
            <div className="pd-newpay-modes">
              {(
                [
                  ["auto", t("Patient:Payment:SplitAuto")],
                  ["manual", t("Patient:Payment:SplitManual")],
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
              <FloatingLabel label={t("Patient:Payment:AmountLabel")} floated>
                <CurrencyInput
                  className="pd-newpay-amount"
                  value={autoAmount}
                  max={autoDefault}
                  onChange={setAmount}
                />
              </FloatingLabel>
            ) : (
              <div className="pd-newpay-manual">
                {chosen.length === 0 ? (
                  <p className="pd-newpay-empty">{t("Patient:Payment:SelectServiceFirst")}</p>
                ) : (
                  chosen.map((line) => (
                    <div key={line.id}>
                      <span>{line.serviceName ?? line.code}</span>
                      <CurrencyInput
                        value={shareOf(line)}
                        max={line.outstandingAmount}
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
              <FloatingLabel label={t("Patient:Payment:NoteLabel")} floated={note.length > 0}>
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
              <CreditCardOutlined /> {t("Patient:Payment:MethodHeader")}
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
                  <span>{t("Patient:Payment:Select")}</span>
                  <span>
                    {accountKind === PAYMENT_ACCOUNT_KIND.Bank
                      ? t("Patient:Payment:BankName")
                      : t("Patient:Payment:MomoPhone")}
                  </span>
                  <span>
                    {accountKind === PAYMENT_ACCOUNT_KIND.Bank
                      ? t("Patient:Payment:AccountNumber")
                      : t("Patient:Payment:AccountHolder")}
                  </span>
                </div>
                {accounts.length === 0 ? (
                  <p className="pd-newpay-empty">
                    {accountKind === PAYMENT_ACCOUNT_KIND.Bank
                      ? t("Patient:Payment:NoBankMethod")
                      : t("Patient:Payment:NoMomoMethod")}
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
                {t("Patient:Payment:AmountExceedsBalance")}
              </p>
            ) : null}
          </section>
        </div>
      </div>
    </Modal>
  );
}
