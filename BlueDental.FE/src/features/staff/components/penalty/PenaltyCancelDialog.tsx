import { Form, Input } from "antd";
import { CloseCircleOutlined } from "@ant-design/icons";
import { AppDialog } from "@/components/AppDialog";
import { t } from "@/lib/i18n";

interface Props {
  open: boolean;
  /** Whose penalty is being cancelled, named in the subtitle. */
  staffName: string;
  pending: boolean;
  onConfirm: (reason: string) => void;
  onClose: () => void;
}

/** Huỷ phiếu chế tài — a reason is required, the server refuses one without. */
export function PenaltyCancelDialog({ open, staffName, pending, onConfirm, onClose }: Props) {
  const [form] = Form.useForm<{ reason: string }>();

  return (
    <AppDialog
      open={open}
      title={t("StaffPenalty:CancelTitle")}
      subtitle={staffName}
      width={460}
      canSave
      saving={pending}
      saveLabel={t("StaffPenalty:Cancel")}
      saveIcon={<CloseCircleOutlined />}
      cancelLabel={t("Common:Close")}
      onSave={() => form.submit()}
      onClose={onClose}
    >
      <Form form={form} layout="vertical" preserve={false} onFinish={(values) => onConfirm(values.reason.trim())}>
        <Form.Item
          name="reason"
          label={t("StaffPenalty:CancelReason")}
          rules={[{ required: true, whitespace: true, message: t("StaffPenalty:Required:CancelReason") }]}
        >
          <Input.TextArea rows={3} maxLength={500} showCount autoFocus />
        </Form.Item>
      </Form>
    </AppDialog>
  );
}
