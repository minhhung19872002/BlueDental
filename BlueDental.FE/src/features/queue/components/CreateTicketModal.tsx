import { Form, Input, Modal, Radio, Select } from "antd";
import { t } from "@/lib/i18n";
import { QueueTicketPriority, type CreateQueueTicketInput, type ServiceCounter } from "../types";
import { usePatientList } from "@/features/patient-management/api/patientQueries";
import { useState } from "react";
import { useDebounce } from "@/hooks/useDebounce";

interface CreateTicketModalProps {
  open: boolean;
  loading: boolean;
  counters: ServiceCounter[];
  onCancel: () => void;
  onSubmit: (values: CreateQueueTicketInput) => void;
}

export function CreateTicketModal({
  open,
  loading,
  counters,
  onCancel,
  onSubmit,
}: CreateTicketModalProps) {
  const [form] = Form.useForm<CreateQueueTicketInput>();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const { data: patients, isLoading: patientsLoading } = usePatientList({
    filter: debouncedSearch,
    skipCount: 0,
    maxResultCount: 20,
  });

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
      okText={t("Queue:CreateModal:Submit")}
      cancelText={t("Hủy")}
      destroyOnClose
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={{ priority: QueueTicketPriority.Normal }}
      >
        <Form.Item
          name="patientId"
          label={t("Queue:CreateModal:Patient")}
          rules={[{ required: true, message: t("Queue:CreateModal:PatientRequired") }]}
        >
          <Select
            showSearch
            placeholder={t("Queue:CreateModal:PatientSearch")}
            filterOption={false}
            onSearch={setSearch}
            loading={patientsLoading}
            options={(patients?.items ?? []).map((p) => ({
              label: `${p.patientCode ?? ""} — ${p.fullName}`,
              value: p.id,
            }))}
          />
        </Form.Item>
        <Form.Item name="priority" label={t("Queue:CreateModal:Priority")}>
          <Radio.Group>
            <Radio value={QueueTicketPriority.Normal}>{t("Queue:Priority:Normal")}</Radio>
            <Radio value={QueueTicketPriority.Urgent}>{t("Queue:Priority:Urgent")}</Radio>
          </Radio.Group>
        </Form.Item>
        {counters.length > 0 && (
          <Form.Item name="counterId" label={t("Queue:CreateModal:Counter")}>
            <Select
              allowClear
              placeholder={t("Queue:CreateModal:CounterSearch")}
              options={counters.map((c) => ({
                label: c.name,
                value: c.id,
              }))}
            />
          </Form.Item>
        )}
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
