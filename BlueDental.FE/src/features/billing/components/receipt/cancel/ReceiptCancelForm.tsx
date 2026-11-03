import { Button, Form, Input, Radio } from "antd";
import { t } from "@/lib/i18n";
import { RECEIPT_CANCEL_REASON, type CancelReceiptInput, type ReceiptCancelReason } from "../../../api/paymentReceiptApi";
import { CANCEL_REASON_KEYS } from "../receiptStatus";

/** Matches PatientPayment.MaxCancelReasonLength. */
const DETAIL_MAX_LENGTH = 500;

const REASONS: ReceiptCancelReason[] = [
  RECEIPT_CANCEL_REASON.WrongPayer,
  RECEIPT_CANCEL_REASON.WrongAmountOrService,
  RECEIPT_CANCEL_REASON.Duplicate,
  RECEIPT_CANCEL_REASON.Other,
];

interface FormValues {
  reasonCode?: ReceiptCancelReason;
  reason?: string;
}

interface Props {
  pending: boolean;
  onSubmit: (input: CancelReceiptInput) => void;
  onBack: () => void;
}

/**
 * Lý do hủy (P2610 mock): one of the four fixed reasons and a description,
 * both required (BA note). "Gửi yêu cầu hủy" stays off until both are given.
 */
export function ReceiptCancelForm({ pending, onSubmit, onBack }: Props) {
  const [form] = Form.useForm<FormValues>();
  const reasonCode = Form.useWatch("reasonCode", form);
  const reason = Form.useWatch("reason", form);
  const ready = reasonCode !== undefined && Boolean(reason?.trim());

  const handleFinish = (values: FormValues) => {
    if (values.reasonCode === undefined || !values.reason) return;
    onSubmit({ reasonCode: values.reasonCode, reason: values.reason.trim() });
  };

  return (
    <Form
      form={form}
      layout="vertical"
      className="rcpt-cancel-card rcpt-cancel-form"
      requiredMark
      disabled={pending}
      onFinish={handleFinish}
    >
      <Form.Item
        name="reasonCode"
        label={t("Receipt:Cancel:Reason")}
        rules={[{ required: true, message: t("Receipt:Cancel:ReasonRequired") }]}
      >
        <Radio.Group className="rcpt-cancel-reasons">
          {REASONS.map((code) => (
            <Radio key={code} value={code} className="rcpt-cancel-reason">
              {t(CANCEL_REASON_KEYS[code])}
            </Radio>
          ))}
        </Radio.Group>
      </Form.Item>
      <Form.Item
        name="reason"
        label={t("Receipt:Cancel:Detail")}
        rules={[{ required: true, whitespace: true, message: t("Receipt:Cancel:DetailRequired") }]}
      >
        <Input.TextArea
          autoSize={{ minRows: 2, maxRows: 6 }}
          maxLength={DETAIL_MAX_LENGTH}
          placeholder={t("Receipt:Cancel:DetailPlaceholder")}
        />
      </Form.Item>
      <div className="rcpt-cancel-foot">
        <Button onClick={onBack} disabled={pending}>
          {t("Treatment:Common:GoBack")}
        </Button>
        <Button type="primary" danger htmlType="submit" loading={pending} disabled={!ready || pending}>
          {t("Receipt:Cancel:Submit")}
        </Button>
      </div>
    </Form>
  );
}
