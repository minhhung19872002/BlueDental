import { Form, Input } from "antd";
import { CloseCircleOutlined } from "@ant-design/icons";
import { AppDialog } from "@/components/AppDialog";
import { t } from "@/lib/i18n";

interface Props {
  open: boolean;
  /** The receipt being cancelled, named in the subtitle. */
  code: string | undefined;
  pending: boolean;
  onConfirm: (reason: string) => void;
  onClose: () => void;
}

/**
 * Huỷ phiếu thanh toán — a reason is required, the server refuses one without
 * (bug list item 28: a receipt vanished with no reason and no trace).
 */
export function PaymentCancelDialog({ open, code, pending, onConfirm, onClose }: Props) {
  const [form] = Form.useForm<{ reason: string }>();

  return (
    <AppDialog
      open={open}
      title={t("Treatment:Payment:CancelPaymentConfirm")}
      subtitle={code}
      width={460}
      canSave
      saving={pending}
      saveLabel={t("Common:CancelAlt")}
      saveIcon={<CloseCircleOutlined />}
      cancelLabel={t("Common:Close")}
      onSave={() => form.submit()}
      onClose={onClose}
    >
      <Form form={form} layout="vertical" preserve={false} onFinish={(values) => onConfirm(values.reason.trim())}>
        <Form.Item
          name="reason"
          label={t("Treatment:Payment:CancelReason")}
          rules={[{ required: true, whitespace: true, message: t("Treatment:Payment:CancelReasonRequired") }]}
        >
          <Input.TextArea rows={3} maxLength={500} showCount autoFocus />
        </Form.Item>
      </Form>
    </AppDialog>
  );
}
