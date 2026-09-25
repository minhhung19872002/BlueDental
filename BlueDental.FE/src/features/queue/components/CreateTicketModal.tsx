import { Form, Input, Modal, Radio } from "antd";
import { t } from "@/lib/i18n";
import { QueueTicketPriority, type CreateQueueTicketInput } from "../types";

interface CreateTicketModalProps {
  open: boolean;
  loading: boolean;
  onCancel: () => void;
  onSubmit: (values: CreateQueueTicketInput) => void;
}

/**
 * "Lấy số mới": a walk-in takes a number before any record exists, so there is
 * no patient to pick, and the counter is decided later by whichever counter
 * calls the number (BA item 22).
 */
export function CreateTicketModal({ open, loading, onCancel, onSubmit }: CreateTicketModalProps) {
  const [form] = Form.useForm<CreateQueueTicketInput>();

  const handleOk = () => {
    form.validateFields().then((values) => {
      onSubmit(values);
      form.resetFields();
    });
  };

  return (
    <Modal
      title={t("Queue:CreateModal:Title")}
      open={open}
      onOk={handleOk}
      onCancel={onCancel}
      confirmLoading={loading}
      okButtonProps={{ disabled: loading }}
      okText={t("Queue:CreateModal:Submit")}
      cancelText={t("Hủy")}
      destroyOnClose
    >
      <Form form={form} layout="vertical" initialValues={{ priority: QueueTicketPriority.Normal }}>
        <Form.Item name="priority" label={t("Queue:CreateModal:Priority")}>
          <Radio.Group>
            <Radio value={QueueTicketPriority.Normal}>{t("Queue:Priority:Normal")}</Radio>
            <Radio value={QueueTicketPriority.Urgent}>{t("Queue:Priority:Urgent")}</Radio>
          </Radio.Group>
        </Form.Item>
        <Form.Item name="serviceType" label={t("Queue:CreateModal:ServiceType")}>
          <Input placeholder={t("Queue:CreateModal:ServiceTypePlaceholder")} />
        </Form.Item>
        <Form.Item name="note" label={t("Queue:CreateModal:Note")}>
          <Input.TextArea rows={2} placeholder={t("Queue:CreateModal:NotePlaceholder")} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
