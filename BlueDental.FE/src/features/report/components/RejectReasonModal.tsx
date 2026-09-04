import { useCallback, useEffect } from "react";
import { Form, Input } from "antd";
import { FormModal } from "@/components/FormModal";
import { t } from "@/lib/i18n";

interface Props {
  open: boolean;
  code: string;
  onConfirm: (reason: string) => void;
  onClose: () => void;
}

interface RejectFormValues {
  reason: string;
}

/** "Từ chối" requires a reason, like every rejection in the system. */
export function RejectReasonModal({ open, code, onConfirm, onClose }: Props) {
  const [form] = Form.useForm<RejectFormValues>();

  useEffect(() => {
    if (open) form.resetFields();
  }, [open, form]);

  const handleSubmit = useCallback(async () => {
    const values = await form.validateFields();
    onConfirm(values.reason.trim());
  }, [form, onConfirm]);

  return (
    <FormModal
      open={open}
      title={t("Từ chối phiếu {0}", code)}
      width={480}
      submitLabel={t("Từ chối")}
      onSubmit={handleSubmit}
      onClose={onClose}
    >
      <Form form={form} layout="vertical" requiredMark>
        <Form.Item
          name="reason"
          label={t("Lý do từ chối")}
          rules={[{ required: true, whitespace: true, message: t("Vui lòng nhập lý do") }]}
        >
          <Input.TextArea rows={3} placeholder={t("Nhập lý do từ chối")} />
        </Form.Item>
      </Form>
    </FormModal>
  );
}
