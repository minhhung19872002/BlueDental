import { Form, InputNumber } from "antd";
import { AppDialog } from "@/components/AppDialog";
import { t } from "@/lib/i18n";
import type { PayrollPeriod, PayrollTermsInput } from "../../api/payrollApi";

interface Props {
  period: PayrollPeriod | null;
  saving: boolean;
  onSubmit: (input: PayrollTermsInput) => void;
  onClose: () => void;
}

/** "Thông số" — ngày công chuẩn and hệ số tăng ca of the month's sheet. */
export function PayrollTermsDialog({ period, saving, onSubmit, onClose }: Props) {
  const [form] = Form.useForm<PayrollTermsInput>();

  return (
    <AppDialog
      open={period !== null}
      title={t("Payroll:Terms")}
      width={420}
      canSave
      saving={saving}
      cancelLabel={t("Common:Cancel")}
      onSave={() => form.submit()}
      onClose={onClose}
    >
      {period && (
        <Form
          form={form}
          layout="vertical"
          preserve={false}
          onFinish={onSubmit}
          initialValues={{ standardWorkDays: period.standardWorkDays, overtimeRate: period.overtimeRate }}
        >
          <Form.Item name="standardWorkDays" label={t("Payroll:StandardWorkDays")} rules={[{ required: true }]}>
            <InputNumber min={0.5} max={31} step={0.5} className="payroll-dialog__number" />
          </Form.Item>
          <Form.Item name="overtimeRate" label={t("Payroll:OvertimeRate")} rules={[{ required: true }]}>
            <InputNumber min={1} max={5} step={0.1} className="payroll-dialog__number" />
          </Form.Item>
        </Form>
      )}
    </AppDialog>
  );
}
