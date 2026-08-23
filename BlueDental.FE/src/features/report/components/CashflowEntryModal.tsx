import { useEffect } from "react";
import { DatePicker, Form, Input, InputNumber, Modal, Select, message } from "antd";
import dayjs from "dayjs";
import { useTranslation } from "react-i18next";
import {
  CASH_HOLDING,
  CASH_HOLDING_LABELS,
  CASH_TRANSACTION_TYPE,
  useCashflowCategories,
  useCreateCashflowEntry,
  type CashHolding,
  type CashTransactionType,
} from "../api/financeApi";
import { useCurrentBranchId } from "@/lib/clinicBranch";
import { useAuthStore } from "@/features/auth/store/authStore";
import { extractApiError } from "@/lib/apiError";

interface CashflowEntryModalProps {
  open: boolean;
  transactionType: CashTransactionType;
  onClose: () => void;
}

interface CashflowFormValues {
  fromHolding?: CashHolding;
  toHolding?: CashHolding;
  amount: number;
  categoryId?: string;
  entryDate: dayjs.Dayjs;
  note?: string;
}

const HOLDING_OPTIONS = Object.entries(CASH_HOLDING_LABELS).map(([value, label]) => ({
  value: Number(value) as CashHolding,
  label,
}));

export function CashflowEntryModal({ open, transactionType, onClose }: CashflowEntryModalProps) {
  const { t } = useTranslation();
  const [form] = Form.useForm<CashflowFormValues>();
  const branchId = useCurrentBranchId();
  const currentUserId = useAuthStore((s) => s.user?.id);
  const createEntry = useCreateCashflowEntry();
  const { data: categoryPage } = useCashflowCategories(branchId, true);

  const needsFrom = transactionType !== CASH_TRANSACTION_TYPE.Deposit;
  const needsTo = transactionType !== CASH_TRANSACTION_TYPE.Withdraw;

  const TITLES: Record<CashTransactionType, string> = {
    [CASH_TRANSACTION_TYPE.Deposit]: t("cashflowModal.titleDeposit"),
    [CASH_TRANSACTION_TYPE.Withdraw]: t("cashflowModal.titleWithdraw"),
    [CASH_TRANSACTION_TYPE.Transfer]: t("cashflowModal.titleTransfer"),
  };

  useEffect(() => {
    if (!open) return;

    form.setFieldsValue({
      fromHolding: needsFrom ? CASH_HOLDING.Cash : undefined,
      toHolding: needsTo ? (transactionType === CASH_TRANSACTION_TYPE.Transfer ? CASH_HOLDING.Bank : CASH_HOLDING.Cash) : undefined,
      amount: undefined,
      categoryId: undefined,
      entryDate: dayjs(),
      note: undefined,
    });
  }, [open, transactionType, needsFrom, needsTo, form]);

  const handleSubmit = async () => {
    const values = await form.validateFields();

    if (!currentUserId) {
      message.error(t("cashflowModal.unknownUser"));
      return;
    }

    if (
      transactionType === CASH_TRANSACTION_TYPE.Transfer &&
      values.fromHolding === values.toHolding
    ) {
      message.error(t("cashflowModal.sameHoldingError"));
      return;
    }

    try {
      await createEntry.mutateAsync({
        clinicBranchId: branchId,
        transactionType,
        fromHolding: needsFrom ? values.fromHolding : null,
        toHolding: needsTo ? values.toHolding : null,
        amount: values.amount,
        categoryId: values.categoryId ?? null,
        createdByStaffId: currentUserId,
        entryDate: values.entryDate.format("YYYY-MM-DD"),
        note: values.note,
      });

      message.success(t("cashflowModal.successMessage", { type: TITLES[transactionType].toLowerCase() }));
      onClose();
    } catch (error) {
      message.error(extractApiError(error));
    }
  };

  return (
    <Modal
      open={open}
      title={TITLES[transactionType]}
      okText={t("cashflowModal.okText")}
      cancelText={t("cashflowModal.cancel")}
      confirmLoading={createEntry.isPending}
      onOk={handleSubmit}
      onCancel={onClose}
      destroyOnHidden
    >
      <Form form={form} layout="vertical" requiredMark>
        {needsFrom && (
          <Form.Item
            name="fromHolding"
            label={t("cashflowModal.fromLabel")}
            rules={[{ required: true, message: t("cashflowModal.fromRequired") }]}
          >
            <Select options={HOLDING_OPTIONS} />
          </Form.Item>
        )}

        {needsTo && (
          <Form.Item
            name="toHolding"
            label={t("cashflowModal.toLabel")}
            rules={[{ required: true, message: t("cashflowModal.toRequired") }]}
          >
            <Select options={HOLDING_OPTIONS} />
          </Form.Item>
        )}

        <Form.Item
          name="amount"
          label={t("cashflowModal.amountLabel")}
          rules={[
            { required: true, message: t("cashflowModal.amountRequired") },
            { type: "number", min: 1, message: t("cashflowModal.amountMin") },
          ]}
        >
          <InputNumber<number>
            style={{ width: "100%" }}
            min={0}
            step={100000}
            formatter={(v) => `${v ?? ""}`.replace(/\B(?=(\d{3})+(?!\d))/g, ".")}
            parser={(v) => Number((v ?? "").replace(/\./g, ""))}
          />
        </Form.Item>

        <Form.Item name="categoryId" label={t("cashflowModal.categoryLabel")}>
          <Select
            allowClear
            placeholder={t("cashflowModal.categoryPlaceholder")}
            options={(categoryPage?.items ?? []).map((c) => ({ value: c.id, label: c.name }))}
          />
        </Form.Item>

        <Form.Item name="entryDate" label={t("cashflowModal.dateLabel")} rules={[{ required: true }]}>
          <DatePicker style={{ width: "100%" }} format="DD/MM/YYYY" />
        </Form.Item>

        <Form.Item name="note" label={t("cashflowModal.noteLabel")}>
          <Input.TextArea rows={2} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
