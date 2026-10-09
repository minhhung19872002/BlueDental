import { Form, Input, Modal, Radio, Select } from "antd";
import { t } from "@/lib/i18n";
import { QueueTicketPriority, type CreateQueueTicketInput, type ServiceCounter } from "../types";
import { bareDentistName } from "../utils/dentistName";

interface CreateTicketModalProps {
  open: boolean;
  loading: boolean;
  counters: ServiceCounter[];
  onCancel: () => void;
  onSubmit: (values: CreateQueueTicketInput) => void;
}

function counterLabel(counter: ServiceCounter): string {
  const name = counter.dentistName
    ? `${counter.name} · ${t("Queue:Card:Dentist", bareDentistName(counter.dentistName))}`
    : counter.name;
  return counter.isActive ? name : `${name} (${t("Queue:Counter:Paused")})`;
}

/**
 * "Lấy số mới": the receptionist picks the counter, and the number comes from
 * that counter's own sequence ("B016"). A paused counter hands out no number.
 * No patient — a walk-in takes a number before any record exists (BA).
 */
export function CreateTicketModal({
  open,
  loading,
  counters,
  onCancel,
  onSubmit,
}: CreateTicketModalProps) {
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
      cancelText={t("Common:Cancel")}
      destroyOnHidden
    >
      <Form
        form={form}
        layout="vertical"
        className="queue-ticket-form"
        initialValues={{ priority: QueueTicketPriority.Normal }}
      >
        <Form.Item
          name="counterId"
          label={t("Queue:CreateModal:Counter")}
          rules={[{ required: true, message: t("Queue:CreateModal:CounterRequired") }]}
        >
          <Select
            showSearch
            optionFilterProp="label"
            placeholder={t("Queue:CreateModal:CounterSearch")}
            options={counters.map((counter) => ({
              value: counter.id,
              label: counterLabel(counter),
              disabled: !counter.isActive,
            }))}
          />
        </Form.Item>
        <Form.Item
          name="priority"
          className="queue-ticket-form__priority"
          label={t("Queue:CreateModal:Priority")}
        >
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
