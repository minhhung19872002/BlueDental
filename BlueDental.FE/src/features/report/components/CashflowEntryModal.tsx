import { useCallback, useEffect, useMemo } from "react";
import { Col, DatePicker, Form, Input, Row, Select } from "antd";
import dayjs from "dayjs";
import { AppDialog } from "@/components/AppDialog";
import { CurrencyInput } from "@/components/CurrencyInput";
import { FloatingField } from "@/components/FloatingField";
import { FloatingLabel } from "@/components/FloatingLabel";
import { SearchSelect } from "@/components/SearchSelect";
import { t } from "@/lib/i18n";
import { formatVND } from "@/utils/format";
import {
  CASH_HOLDING,
  CASH_TRANSACTION_TYPE,
  cashHoldingLabels,
  type CashHolding,
  type CashTransactionType,
} from "../api/financeApi";
import { notifyDemoAction, useMockCashBalance, useMockCashbookCategories } from "../api/reportMockQueries";
import type { CashflowEntryVm } from "../types/mock";

interface Props {
  open: boolean;
  transactionType: CashTransactionType;
  entry: CashflowEntryVm | null;
  onClose: () => void;
}

interface FormValues {
  holding: CashHolding;
  toHolding?: CashHolding;
  amount?: number;
  categoryId?: string;
  note?: string;
}

const HOLDINGS: CashHolding[] = [CASH_HOLDING.Cash, CASH_HOLDING.Bank];

const TITLES: Record<CashTransactionType, { create: () => string; edit: () => string }> = {
  [CASH_TRANSACTION_TYPE.Deposit]: { create: () => t("Tạo giao dịch nạp"), edit: () => t("Sửa giao dịch nạp") },
  [CASH_TRANSACTION_TYPE.Withdraw]: { create: () => t("Tạo giao dịch rút"), edit: () => t("Sửa giao dịch rút") },
  [CASH_TRANSACTION_TYPE.Transfer]: { create: () => t("Tạo giao dịch luân chuyển"), edit: () => t("Sửa giao dịch luân chuyển") },
};

const BALANCE_KEY: Record<CashHolding, "cash" | "bank" | "customerPrepaid"> = {
  [CASH_HOLDING.Cash]: "cash",
  [CASH_HOLDING.Bank]: "bank",
  [CASH_HOLDING.CustomerPrepaid]: "customerPrepaid",
};

/**
 * Nạp / Rút / Luân chuyển — the reference's grid: holding (+ destination for a
 * transfer), amount, the fixed execution date, category (nạp / rút only), note,
 * and the available balance under rút / luân chuyển.
 */
export function CashflowEntryModal({ open, transactionType, entry, onClose }: Props) {
  const [form] = Form.useForm<FormValues>();
  const { data: balance } = useMockCashBalance();
  const { data: categories = [] } = useMockCashbookCategories();
  const holdingLabels = useMemo(cashHoldingLabels, []);

  const isTransfer = transactionType === CASH_TRANSACTION_TYPE.Transfer;
  const title = entry ? TITLES[transactionType].edit() : TITLES[transactionType].create();
  const holding = Form.useWatch("holding", form) ?? CASH_HOLDING.Cash;
  const holdingOptions = HOLDINGS.map((h) => ({ value: h, label: holdingLabels[h] }));
  const entryDate = entry ? dayjs(entry.entryDate) : dayjs();

  useEffect(() => {
    if (!open) return;
    form.resetFields();
    if (entry) {
      form.setFieldsValue({
        holding: entry.fromHolding ?? entry.toHolding ?? CASH_HOLDING.Cash,
        toHolding: entry.toHolding ?? undefined,
        amount: entry.amount,
        note: entry.note ?? undefined,
      });
    }
  }, [open, entry, form]);

  const handleFinish = useCallback(() => {
    notifyDemoAction(title);
    onClose();
  }, [title, onClose]);

  return (
    <AppDialog open={open} title={title} width={772} canSave onSave={() => form.submit()} onClose={onClose}>
      <Form form={form} layout="vertical" requiredMark={false} initialValues={{ holding: CASH_HOLDING.Cash }} onFinish={handleFinish}>
        <Row gutter={[16, 12]}>
          <Col xs={24} md={12}>
            <FloatingField name="holding" label={t("Hình thức")} required rules={[{ required: true }]}>
              <Select options={holdingOptions} />
            </FloatingField>
          </Col>
          {isTransfer ? (
            <Col xs={24} md={12}>
              <FloatingField name="toHolding" label={t("Luân chuyển đến")} required rules={[{ required: true, message: t("Vui lòng chọn nơi nhận") }]}>
                <Select options={holdingOptions.filter((o) => o.value !== holding)} />
              </FloatingField>
            </Col>
          ) : null}
          <Col xs={24} md={12}>
            <FloatingField name="amount" label={t("Số tiền (VNĐ)")} required rules={[{ required: true, type: "number", min: 1, message: t("Số tiền phải lớn hơn 0") }]}>
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
              <Input.TextArea rows={3} />
            </FloatingField>
          </Col>
        </Row>

        {transactionType !== CASH_TRANSACTION_TYPE.Deposit ? (
          <div className="report-balance-hint">
            <div className="report-balance-hint-label">{t("Số dư khả dụng ({0}):", holdingLabels[holding])}</div>
            <div className="report-balance-hint-value">{formatVND(balance?.[BALANCE_KEY[holding]] ?? 0)} đ</div>
          </div>
        ) : null}
      </Form>
    </AppDialog>
  );
}
