import { useCallback, useEffect, useMemo } from "react";
import { Col, DatePicker, Form, Input, Row, Select } from "antd";
import type { Rule } from "antd/es/form";
import dayjs from "dayjs";
import { toast } from "sonner";
import { AppDialog } from "@/components/AppDialog";
import { CurrencyInput } from "@/components/CurrencyInput";
import { FloatingField } from "@/components/FloatingField";
import { FloatingLabel } from "@/components/FloatingLabel";
import { SearchSelect } from "@/components/SearchSelect";
import { t } from "@/lib/i18n";
import { useCurrentBranchId } from "@/lib/clinicBranch";
import { useAuthStore } from "@/features/auth/store/authStore";
import { formatMoneyUnit } from "@/utils/format";
import {
  API_DATE_FORMAT,
  CASH_HOLDING,
  CASH_TRANSACTION_TYPE,
  cashHoldingLabels,
  cashHoldingsFor,
  useCashBalance,
  useCashflowCategories,
  useCreateCashflowEntry,
  useUpdateCashflowEntry,
  type CashflowEntryDto,
  type CashHolding,
  type CashTransactionType,
} from "../api/financeApi";

interface Props {
  open: boolean;
  transactionType: CashTransactionType;
  entry: CashflowEntryDto | null;
  onClose: () => void;
}

interface FormValues {
  holding: CashHolding;
  toHolding?: CashHolding;
  amount?: number;
  categoryId?: string;
  note?: string;
}

const NOTE_MAX_LENGTH = 250;

/** A transfer only moves between cash and bank, so the "other side" is always one of the two. */
function otherHolding(holding: CashHolding): CashHolding {
  return holding === CASH_HOLDING.Cash ? CASH_HOLDING.Bank : CASH_HOLDING.Cash;
}

const TITLES: Record<CashTransactionType, { create: () => string; edit: () => string }> = {
  [CASH_TRANSACTION_TYPE.Deposit]: { create: () => t("Tạo giao dịch nạp"), edit: () => t("Cập nhật giao dịch nạp") },
  [CASH_TRANSACTION_TYPE.Withdraw]: { create: () => t("Tạo giao dịch rút"), edit: () => t("Cập nhật giao dịch rút") },
  [CASH_TRANSACTION_TYPE.Transfer]: { create: () => t("Tạo giao dịch luân chuyển"), edit: () => t("Cập nhật giao dịch luân chuyển") },
};

/** The "Số dư khả dụng (…)" line names the card holding by its overview label (reference). */
function balanceHintLabelsFor(): Record<CashHolding, string> {
  return { ...cashHoldingLabels(), [CASH_HOLDING.Card]: t("Cà thẻ chờ đối soát") };
}

/** Which balance figure backs the "Số dư khả dụng" line for each holding. */
const BALANCE_KEY: Record<CashHolding, "cash" | "bank" | "customerPrepaid" | "cardPending"> = {
  [CASH_HOLDING.Cash]: "cash",
  [CASH_HOLDING.Bank]: "bank",
  [CASH_HOLDING.CustomerPrepaid]: "customerPrepaid",
  [CASH_HOLDING.Card]: "cardPending",
};

/** Which side of the movement each form field feeds, per transaction type. */
function toHoldings(transactionType: CashTransactionType, values: FormValues) {
  switch (transactionType) {
    case CASH_TRANSACTION_TYPE.Deposit:
      return { fromHolding: null, toHolding: values.holding };
    case CASH_TRANSACTION_TYPE.Withdraw:
      return { fromHolding: values.holding, toHolding: null };
    default:
      return { fromHolding: values.holding, toHolding: values.toHolding ?? null };
  }
}

export function CashflowEntryModal({ open, transactionType, entry, onClose }: Props) {
  const [form] = Form.useForm<FormValues>();
  const branchId = useCurrentBranchId();
  const currentUserId = useAuthStore((s) => s.user?.id ?? "");
  const { data: balance } = useCashBalance(branchId);
  const { data: categoryResult } = useCashflowCategories(branchId, true);
  const categories = useMemo(() => categoryResult?.items ?? [], [categoryResult]);
  const holdingLabels = useMemo(cashHoldingLabels, []);
  const balanceHintLabels = useMemo(balanceHintLabelsFor, []);
  const createMutation = useCreateCashflowEntry();
  const updateMutation = useUpdateCashflowEntry();
  const saving = createMutation.isPending || updateMutation.isPending;

  const isTransfer = transactionType === CASH_TRANSACTION_TYPE.Transfer;
  const isDeposit = transactionType === CASH_TRANSACTION_TYPE.Deposit;
  const title = entry ? TITLES[transactionType].edit() : TITLES[transactionType].create();
  const holding = Form.useWatch("holding", form) ?? CASH_HOLDING.Cash;
  // Nạp lists cash / bank / card; Rút and Luân chuyển list cash / bank only (reference).
  const holdingOptions = cashHoldingsFor(transactionType).map((h) => ({ value: h, label: holdingLabels[h] }));
  const entryDate = entry ? dayjs(entry.entryDate) : dayjs();
  // Reference: Rút and Luân chuyển always show the line; Nạp only for the card holding.
  const showBalanceHint = !isDeposit || holding === CASH_HOLDING.Card;

  // Money already sitting in this entry is available again when it is being corrected.
  const availableBalance = useMemo(() => {
    const current = balance?.[BALANCE_KEY[holding]] ?? 0;
    const refund = entry && entry.fromHolding === holding ? entry.amount : 0;
    return current + refund;
  }, [balance, holding, entry]);

  useEffect(() => {
    if (!open) return;
    form.resetFields();
    if (entry) {
      form.setFieldsValue({
        holding: entry.fromHolding ?? entry.toHolding ?? CASH_HOLDING.Cash,
        toHolding: entry.toHolding ?? undefined,
        amount: entry.amount,
        categoryId: entry.categoryId ?? undefined,
        note: entry.note ?? undefined,
      });
    }
  }, [open, entry, form]);

  // Reference (observed 2026-09-22): both selects list both holdings and never show an
  // error — picking a side equal to the other side flips that other side instead.
  // Runs inside the change event (not an effect): the `dependencies` re-validation of
  // "toHolding" has already captured the clashing value, so the swap re-validates
  // explicitly — the newer validation supersedes the stale one and clears its error.
  const handleValuesChange = useCallback(
    (changed: Partial<FormValues>) => {
      if (!isTransfer) return;
      const picked = changed.holding ?? changed.toHolding;
      if (picked === undefined) return;
      const otherSide = changed.holding !== undefined ? "toHolding" : "holding";
      if (form.getFieldValue(otherSide) !== picked) return;
      form.setFieldValue(otherSide, otherHolding(picked));
      form.validateFields(["toHolding"]).catch(() => undefined);
    },
    [isTransfer, form],
  );

  const handleFinish = useCallback(
    (values: FormValues) => {
      const holdings = toHoldings(transactionType, values);
      const common = {
        ...holdings,
        amount: values.amount ?? 0,
        categoryId: values.categoryId ?? null,
        note: values.note,
      };
      const done = (message: string) => () => {
        toast.success(message);
        onClose();
      };

      if (entry) {
        updateMutation.mutate({ id: entry.id, input: common }, { onSuccess: done(t("Cập nhật giao dịch thành công")) });
        return;
      }
      createMutation.mutate(
        {
          ...common,
          clinicBranchId: branchId,
          transactionType,
          createdByStaffId: currentUserId,
          entryDate: dayjs().format(API_DATE_FORMAT),
        },
        { onSuccess: done(t("Tạo giao dịch thành công")) },
      );
    },
    [branchId, transactionType, entry, currentUserId, createMutation, updateMutation, onClose],
  );

  // The reference refuses a withdrawal or transfer larger than the holding it draws from.
  const amountRules = [
    { required: true, type: "number" as const, min: 1, message: t("Số tiền phải lớn hơn 0") },
    ...(isDeposit
      ? []
      : [
          {
            validator: (_: unknown, value?: number) =>
              value !== undefined && value > availableBalance
                ? Promise.reject(new Error(t("Số dư không đủ để thực hiện giao dịch")))
                : Promise.resolve(),
          },
        ]),
  ];

  // Reads the source from the store at validation time, never from a render closure.
  const targetRules: Rule[] = [
    { required: true, message: t("Vui lòng chọn nơi nhận") },
    ({ getFieldValue }) => ({
      validator: (_: unknown, value?: CashHolding) =>
        value !== undefined && value === getFieldValue("holding")
          ? Promise.reject(new Error(t("Nơi nhận phải khác hình thức chuyển")))
          : Promise.resolve(),
    }),
  ];

  return (
    <AppDialog open={open} title={title} width={772} canSave saving={saving} onSave={() => form.submit()} onClose={onClose}>
      <Form form={form} layout="vertical" requiredMark={false} initialValues={{ holding: CASH_HOLDING.Cash, toHolding: CASH_HOLDING.Bank }} onValuesChange={handleValuesChange} onFinish={handleFinish}>
        <Row gutter={[16, 12]}>
          <Col xs={24} md={12}>
            <FloatingField name="holding" label={t("Hình thức")} required rules={[{ required: true }]}>
              <Select options={holdingOptions} />
            </FloatingField>
          </Col>
          {isTransfer ? (
            <Col xs={24} md={12}>
              <FloatingField name="toHolding" label={t("Luân chuyển đến")} required rules={targetRules} dependencies={["holding"]}>
                <Select options={holdingOptions} />
              </FloatingField>
            </Col>
          ) : null}
          <Col xs={24} md={12}>
            <FloatingField name="amount" label={t("Số tiền (VNĐ)")} required rules={amountRules} dependencies={["holding"]}>
              <CurrencyInput />
            </FloatingField>
          </Col>
          <Col xs={24} md={12}>
            <FloatingLabel label={`${t("Ngày thực hiện")}*`} floated>
              <DatePicker className="report-full-width" value={entryDate} format="DD/MM/YYYY" disabled />
            </FloatingLabel>
          </Col>
          {!isTransfer ? (
            <Col xs={24} md={12}>
              <FloatingField name="categoryId" label={t("Danh mục")}>
                <SearchSelect options={categories.map((c) => ({ value: c.id, label: c.name }))} allowClear />
              </FloatingField>
            </Col>
          ) : null}
          <Col xs={24}>
            <FloatingField name="note" label={t("Ghi chú")}>
              <Input.TextArea rows={3} maxLength={NOTE_MAX_LENGTH} />
            </FloatingField>
          </Col>
        </Row>

        {showBalanceHint ? (
          <div className="report-balance-hint">
            <div className="report-balance-hint-label">{t("Số dư khả dụng ({0}):", balanceHintLabels[holding])}</div>
            <div className="report-balance-hint-value">{formatMoneyUnit(availableBalance)}</div>
          </div>
        ) : null}
      </Form>
    </AppDialog>
  );
}
