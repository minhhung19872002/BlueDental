import { useCallback, useEffect, useMemo } from "react";
import { Col, DatePicker, Form, Input, Row } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import { toast } from "sonner";
import { AppDialog } from "@/components/AppDialog";
import { CurrencyInput } from "@/components/CurrencyInput";
import { FloatingField } from "@/components/FloatingField";
import { FloatingLabel } from "@/components/FloatingLabel";
import { SearchSelect } from "@/components/SearchSelect";
import { t } from "@/lib/i18n";
import { useCurrentBranchId } from "@/lib/clinicBranch";
import { useAuthStore } from "@/features/auth/store/authStore";
import { useStaffList } from "@/features/staff/api/staffQueries";
import { usePatientList } from "@/features/patient-management/api/patientQueries";
import {
  API_DATE_FORMAT,
  PAYMENT_CHANNEL,
  paymentChannelLabels,
  SALES_ENTRY_TYPE,
  useCashflowCategories,
  useCreateSalesEntry,
  useUpdateSalesEntry,
  type PaymentChannel,
  type SalesEntryDto,
  type SalesEntryType,
} from "../api/financeApi";

interface Props {
  open: boolean;
  entry: SalesEntryDto | null;
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

/** The reference's "Hình thức" on a voucher: cash, bank, card, Dư nợ — behind a search box. */
const MODAL_CHANNELS: PaymentChannel[] = [
  PAYMENT_CHANNEL.Cash,
  PAYMENT_CHANNEL.Banking,
  PAYMENT_CHANNEL.Card,
  PAYMENT_CHANNEL.OutstandingDebt,
];

interface ChannelSelectProps {
  value?: PaymentChannel;
  onChange?: (value: PaymentChannel) => void;
  onOpenChange?: (open: boolean) => void;
  options: { value: PaymentChannel; label: string }[];
}

/** SearchSelect speaks strings; the channel is a number, so map at the edge without a cast. */
function ChannelSelect({ value, onChange, onOpenChange, options }: ChannelSelectProps) {
  const handleChange = (next: string | undefined) => {
    const match = options.find((o) => String(o.value) === next);
    if (match) onChange?.(match.value);
  };
  return (
    <SearchSelect
      value={value === undefined ? undefined : String(value)}
      options={options.map((o) => ({ value: String(o.value), label: o.label }))}
      onChange={handleChange}
      onOpenChange={onOpenChange}
    />
  );
}

const COPY: Record<SalesEntryType, { create: () => string; edit: () => string; paidDate: () => string; payer: () => string; category: () => string; description: () => string }> = {
  [SALES_ENTRY_TYPE.Income]: {
    create: () => t("Thêm khoản thu"),
    edit: () => t("Chỉnh sửa khoản thu"),
    paidDate: () => t("Ngày thực thu"),
    payer: () => t("Người nộp"),
    category: () => t("Mục thu"),
    description: () => t("Nội dung thu"),
  },
  [SALES_ENTRY_TYPE.Expense]: {
    create: () => t("Thêm chi phí"),
    edit: () => t("Chỉnh sửa chi phí"),
    paidDate: () => t("Ngày thực chi"),
    payer: () => t("Người nhận"),
    category: () => t("Mục chi"),
    description: () => t("Nội dung chi"),
  },
};

export function SalesEntryModal({ open, entry, defaultType, onClose }: Props) {
  const [form] = Form.useForm<FormValues>();
  const type = entry?.type ?? defaultType;
  const copy = COPY[type];
  const isEdit = entry !== null;
  const isIncome = type === SALES_ENTRY_TYPE.Income;

  const branchId = useCurrentBranchId();
  const currentUserId = useAuthStore((s) => s.user?.id ?? "");
  const { data: staffResult } = useStaffList({ isActive: true, maxResultCount: 200 });
  const { data: patientResult } = usePatientList({ maxResultCount: 200 });
  const { data: categoryResult } = useCashflowCategories(branchId, false);

  const staff = useMemo(
    () => (staffResult?.items ?? []).map((s) => ({ value: s.id, label: s.fullName })),
    [staffResult],
  );
  const patients = useMemo(
    () => (patientResult?.items ?? []).map((p) => ({ value: p.id, label: `${p.patientCode} - ${p.fullName}` })),
    [patientResult],
  );
  const categories = useMemo(
    () => (categoryResult?.items ?? []).filter((c) => c.type === type),
    [categoryResult, type],
  );
  const channelLabels = useMemo(paymentChannelLabels, []);

  const createMutation = useCreateSalesEntry();
  const updateMutation = useUpdateSalesEntry();

  useEffect(() => {
    if (!open) return;
    form.resetFields();
    if (entry) {
      form.setFieldsValue({
        paidDate: dayjs(entry.entryDate),
        amount: entry.amount,
        channel: entry.channel,
        description: entry.description,
        categoryId: entry.categoryId,
        staffId: entry.staffId,
        patientId: entry.patientId ?? undefined,
        payer: entry.payerName ?? undefined,
      });
    }
  }, [open, entry, form]);

  const handleFinish = useCallback(
    (values: FormValues) => {
      if (isEdit && entry) {
        updateMutation.mutate(
          {
            id: entry.id,
            input: {
              categoryId: values.categoryId,
              patientId: values.patientId,
              amount: values.amount ?? 0,
              channel: values.channel,
              description: values.description ?? "",
              entryDate: values.paidDate.format(API_DATE_FORMAT),
              payerName: values.payer?.trim() || undefined,
            },
          },
          {
            onSuccess: () => {
              toast.success(t("Cập nhật phiếu thu chi thành công"));
              onClose();
            },
          },
        );
      } else {
        createMutation.mutate(
          {
            clinicBranchId: branchId,
            type,
            categoryId: values.categoryId,
            staffId: values.staffId ?? currentUserId,
            patientId: values.patientId,
            amount: values.amount ?? 0,
            channel: values.channel,
            description: values.description ?? "",
            entryDate: values.paidDate.format(API_DATE_FORMAT),
            payerName: values.payer?.trim() || undefined,
          },
          {
            onSuccess: () => {
              toast.success(t("Tạo phiếu thu chi thành công"));
              onClose();
            },
          },
        );
      }
    },
    [isEdit, entry, branchId, type, currentUserId, createMutation, updateMutation, onClose],
  );

  const saving = createMutation.isPending || updateMutation.isPending;

  const payerField = (
    <FloatingField name="payer" label={copy.payer()}>
      <Input />
    </FloatingField>
  );

  return (
    <AppDialog open={open} title={isEdit ? copy.edit() : copy.create()} width={772} canSave saving={saving} onSave={() => form.submit()} onClose={onClose}>
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
            <FloatingField name="amount" label={t("Số tiền")} required rules={[{ required: true, type: "number", min: 1, message: t("Vui lòng nhập số tiền") }]}>
              <CurrencyInput />
            </FloatingField>
          </Col>
          <Col xs={24} md={8}>
            <FloatingField name="channel" label={t("Hình thức")}>
              <ChannelSelect options={MODAL_CHANNELS.map((c) => ({ value: c, label: channelLabels[c] }))} />
            </FloatingField>
          </Col>
          {isIncome ? <Col xs={24} md={8}>{payerField}</Col> : null}
          <Col xs={24} md={8}>
            <FloatingField name="categoryId" label={copy.category()} required rules={[{ required: true, message: t("{0} là trường bắt buộc.", copy.category()) }]}>
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
