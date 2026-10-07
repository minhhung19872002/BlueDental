import { Form, Input, InputNumber } from "antd";
import { AppDialog } from "@/components/AppDialog";
import { CurrencyInput } from "@/components/CurrencyInput";
import { t } from "@/lib/i18n";
import type { PayrollEntry, PayrollEntryInput } from "../../api/payrollApi";

interface FormValues {
  workDaysOverride?: number | null;
  bonus?: number;
  otherDeduction?: number;
  note?: string;
}

interface Props {
  entry: PayrollEntry | null;
  saving: boolean;
  onSubmit: (input: PayrollEntryInput) => void;
  onClose: () => void;
}

/** "Điều chỉnh" — the hand-entered parts of one row; recalculating keeps them. */
export function PayrollEntryDialog({ entry, saving, onSubmit, onClose }: Props) {
  const [form] = Form.useForm<FormValues>();

  const handleFinish = (values: FormValues) => {
    onSubmit({
      workDaysOverride: values.workDaysOverride ?? null,
      bonus: values.bonus ?? 0,
      otherDeduction: values.otherDeduction ?? 0,
      note: values.note?.trim() || null,
    });
  };

  return (
    <AppDialog
      open={entry !== null}
      title={t("Payroll:AdjustTitle", entry?.staffName ?? "")}
      width={520}
      canSave
      saving={saving}
      cancelLabel={t("Common:Cancel")}
      onSave={() => form.submit()}
      onClose={onClose}
    >
      {entry && (
        <Form
          form={form}
          layout="vertical"
          preserve={false}
          onFinish={handleFinish}
          initialValues={{
            workDaysOverride: entry.workDaysOverride ?? undefined,
            bonus: entry.bonus || undefined,
            otherDeduction: entry.otherDeduction || undefined,
            note: entry.note ?? undefined,
          }}
        >
          <Form.Item
            name="workDaysOverride"
            label={t("Payroll:WorkDaysOverride")}
            extra={t("Payroll:WorkDaysOverrideHint", String(entry.workedDays))}
          >
            <InputNumber min={0} max={31} step={0.5} className="payroll-dialog__number" />
          </Form.Item>
          <Form.Item name="bonus" label={t("Payroll:Col:Bonus")}>
            <CurrencyInput suffix=" đ" />
          </Form.Item>
          <Form.Item name="otherDeduction" label={t("Payroll:Col:OtherDeduction")}>
            <CurrencyInput suffix=" đ" />
          </Form.Item>
          <Form.Item name="note" label={t("Payroll:Col:Note")}>
            <Input.TextArea rows={2} maxLength={500} />
          </Form.Item>
        </Form>
      )}
    </AppDialog>
  );
}
