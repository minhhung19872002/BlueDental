import { Button, Form, Input, Modal } from "antd";
import { CloseCircleOutlined } from "@ant-design/icons";
import { t } from "@/lib/i18n";

interface Props {
  open: boolean;
  invoiceNumber: string;
  pending: boolean;
  onConfirm: (reason: string) => void;
  onClose: () => void;
}

interface FormValues {
  reason: string;
}

/** Huỷ hoá đơn — the server refuses a void without a reason, so the form does too. */
export function VoidInvoiceDialog({ open, invoiceNumber, pending, onConfirm, onClose }: Props) {
  const [form] = Form.useForm<FormValues>();

  return (
    <Modal
      open={open}
      title={<h2 className="bd-modal-title">{t("Billing:VoidTitle", invoiceNumber)}</h2>}
      onCancel={onClose}
      width={440}
      destroyOnHidden
      footer={
        <div className="billing-dialog-footer">
          <Button onClick={onClose} disabled={pending}>
            {t("Common:Close")}
          </Button>
          <Button
            danger
            type="primary"
            icon={<CloseCircleOutlined />}
            loading={pending}
            disabled={pending}
            onClick={() => form.submit()}
          >
            {t("Billing:Void")}
          </Button>
        </div>
      }
    >
      <Form
        form={form}
        layout="vertical"
        preserve={false}
        onFinish={(values) => onConfirm(values.reason.trim())}
      >
        <Form.Item
          name="reason"
          label={t("Billing:VoidReason")}
          rules={[{ required: true, whitespace: true, message: t("Billing:VoidReasonRequired") }]}
        >
          <Input.TextArea rows={3} maxLength={500} autoFocus />
        </Form.Item>
      </Form>
    </Modal>
  );
}
