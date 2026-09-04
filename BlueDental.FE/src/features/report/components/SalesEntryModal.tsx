import { useCallback, useEffect, useMemo } from "react";
import { Col, DatePicker, Form, Input, Row, Select } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import { AppDialog } from "@/components/AppDialog";
import { CurrencyInput } from "@/components/CurrencyInput";
import { FloatingField } from "@/components/FloatingField";
import { FloatingLabel } from "@/components/FloatingLabel";
import { SearchSelect } from "@/components/SearchSelect";
import { t } from "@/lib/i18n";
import {
  PAYMENT_CHANNEL,
  paymentChannelLabels,
  SALES_ENTRY_TYPE,
  type PaymentChannel,
  type SalesEntryType,
} from "../api/financeApi";
import {
  notifyDemoAction,
  useMockCategories,
  useMockPatientOptions,
  useMockStaffOptions,
} from "../api/reportMockQueries";
import type { SalesEntryVm } from "../types/mock";

interface Props {
  open: boolean;
  entry: SalesEntryVm | null;
  /** Only used when creating — an existing voucher keeps its own type. */
  defaultType: SalesEntryType;
  onClose: () => void;
}

interface FormValues {
  paidDate: Dayjs;
  staffId?: string;
  patientId?: string;
  amount?: number;
  channel: PaymentChannel;
  payer?: string;
  categoryId: string;
  description?: string;
}

const MODAL_CHANNELS: PaymentChannel[] = [PAYMENT_CHANNEL.Cash, PAYMENT_CHANNEL.Banking, PAYMENT_CHANNEL.Card];

/** Labels that differ between thu (income) and chi (expense) vouchers. */
const COPY: Record<SalesEntryType, { create: () => string; edit: () => string; paidDate: () => string; payer: () => string; category: () => string; description: () => string }> = {
  [SALES_ENTRY_TYPE.Income]: {
    create: () => t("Thêm khoản thu"),
    edit: () => t("Sửa khoản thu"),
    paidDate: () => t("Ngày thực thu"),
    payer: () => t("Người nộp"),
    category: () => t("Mục thu"),
    description: () => t("Nội dung thu"),
  },
  [SALES_ENTRY_TYPE.Expense]: {
    create: () => t("Thêm chi phí"),
    edit: () => t("Sửa khoản chi"),
    paidDate: () => t("Ngày thực chi"),
    payer: () => t("Người nhận"),
    category: () => t("Mục chi"),
    description: () => t("Nội dung chi"),
  },
};

/**
 * "Thêm khoản thu" / "Thêm chi phí" — the reference's grid: created date +
 * paid date, staff + customer (thu) or payee (chi), amount (its own row for
 * thu, alongside channel + category for chi), description.
 */
export function SalesEntryModal({ open, entry, defaultType, onClose }: Props) {
  const [form] = Form.useForm<FormValues>();
  const type = entry?.type ?? defaultType;
  const copy = COPY[type];
  const isEdit = entry !== null;
  const isIncome = type === SALES_ENTRY_TYPE.Income;

  const { data: staff = [] } = useMockStaffOptions();
  const { data: patients = [] } = useMockPatientOptions();
  const { data: allCategories = [] } = useMockCategories();
  const categories = useMemo(() => allCategories.filter((c) => c.type === type), [allCategories, type]);
  const channelLabels = useMemo(paymentChannelLabels, []);

  useEffect(() => {
    if (!open) return;
    form.resetFields();
    if (entry) {
      form.setFieldsValue({
        paidDate: dayjs(entry.paidDate),
        amount: entry.amount,
        channel: entry.channel,
        description: entry.description,
        categoryId: allCategories.find((c) => c.name === entry.categoryName)?.id,
      });
    }
  }, [open, entry, form, allCategories]);

  const handleFinish = useCallback(() => {
    notifyDemoAction(isEdit && entry ? t("Sửa phiếu {0}", entry.code) : copy.create());
    onClose();
  }, [isEdit, entry, copy, onClose]);

  // Thu: staff + customer, full-width amount, then channel + payer + category.
  // Chi has no customer, so the payee takes that slot and amount + channel +
  // category share one row (stacked on mobile).
  const payerField = (
    <FloatingField name="payer" label={copy.payer()}>
      <Input />
    </FloatingField>
  );

  return (
    <AppDialog open={open} title={isEdit ? copy.edit() : copy.create()} width={772} canSave onSave={() => form.submit()} onClose={onClose}>
      <Form
        form={form}
        layout="vertical"
        requiredMark={false}
        initialValues={{ paidDate: dayjs(), channel: PAYMENT_CHANNEL.Cash }}
        onFinish={handleFinish}
      >
        <Row gutter={[16, 12]}>
          <Col xs={24} md={12}>
            <FloatingLabel label={t("Ngày tạo")} floated>
              <DatePicker className="report-full-width" value={dayjs(entry?.entryDate)} format="DD/MM/YYYY" disabled />
            </FloatingLabel>
          </Col>
          <Col xs={24} md={12}>
            <FloatingField name="paidDate" label={copy.paidDate()} required rules={[{ required: true, message: t("Vui lòng chọn ngày") }]}>
              <DatePicker className="report-full-width" format="DD/MM/YYYY" allowClear={false} />
            </FloatingField>
          </Col>
          <Col xs={24} md={12}>
            <FloatingField name="staffId" label={t("Chọn nhân viên")}>
              <SearchSelect options={staff} allowClear />
            </FloatingField>
          </Col>
          <Col xs={24} md={12}>
            {isIncome ? (
              <FloatingField name="patientId" label={t("Chọn khách hàng")}>
                <SearchSelect options={patients} allowClear />
              </FloatingField>
            ) : (
              payerField
            )}
          </Col>
          <Col xs={24} md={isIncome ? 24 : 8}>
            <FloatingField name="amount" label={t("Số tiền")} required rules={[{ required: true, type: "number", min: 1, message: t("Số tiền phải lớn hơn 0") }]}>
              <CurrencyInput />
            </FloatingField>
          </Col>
          <Col xs={24} md={8}>
            <FloatingField name="channel" label={t("Hình thức")}>
              <Select options={MODAL_CHANNELS.map((c) => ({ value: c, label: channelLabels[c] }))} />
            </FloatingField>
          </Col>
          {isIncome ? <Col xs={24} md={8}>{payerField}</Col> : null}
          <Col xs={24} md={8}>
            <FloatingField name="categoryId" label={copy.category()} required rules={[{ required: true, message: t("Vui lòng chọn mục") }]}>
              <SearchSelect options={categories.map((c) => ({ value: c.id, label: c.name }))} />
            </FloatingField>
          </Col>
          <Col xs={24}>
            <FloatingField name="description" label={copy.description()}>
              <Input.TextArea rows={4} />
            </FloatingField>
          </Col>
        </Row>
      </Form>
    </AppDialog>
  );
}
