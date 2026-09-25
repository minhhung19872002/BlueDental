import { useState } from "react";
import { Button, Form, Input, Modal, Space, Switch, Table, Tooltip } from "antd";
import { EditOutlined } from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import { t } from "@/lib/i18n";
import { useQueueCounters } from "../api/queueQueries";
import {
  useCreateServiceCounter,
  useUpdateServiceCounter,
  useToggleServiceCounter,
} from "../api/queueMutations";
import type { ServiceCounter } from "../types";

interface CounterManagerModalProps {
  open: boolean;
  onClose: () => void;
}

interface CounterFormValues {
  name: string;
}

export function CounterManagerModal({ open, onClose }: CounterManagerModalProps) {
  const { data: counters, isLoading } = useQueueCounters();
  const createMutation = useCreateServiceCounter();
  const updateMutation = useUpdateServiceCounter();
  const toggleMutation = useToggleServiceCounter();

  const [form] = Form.useForm<CounterFormValues>();
  const [editingId, setEditingId] = useState<string | null>(null);

  const handleSubmit = () => {
    form.validateFields().then((values) => {
      const nextOrder = (counters ?? []).length;
      if (editingId) {
        const current = (counters ?? []).find((c) => c.id === editingId);
        updateMutation.mutate(
          { id: editingId, data: { ...values, sortOrder: current?.sortOrder ?? nextOrder } },
          { onSuccess: () => { form.resetFields(); setEditingId(null); } },
        );
      } else {
        createMutation.mutate({ ...values, sortOrder: nextOrder }, {
          onSuccess: () => form.resetFields(),
        });
      }
    });
  };

  const handleEdit = (record: ServiceCounter) => {
    setEditingId(record.id);
    form.setFieldsValue({ name: record.name });
  };

  const handleCancel = () => {
    setEditingId(null);
    form.resetFields();
  };

  const columns: ColumnsType<ServiceCounter> = [
    {
      title: t("Queue:Counter:Name"),
      dataIndex: "name",
    },
    {
      title: t("Queue:Counter:Status"),
      dataIndex: "isActive",
      width: 160,
      render: (val: boolean, record) => (
        <span className="queue-counter-toggle">
          <Switch
            checked={val}
            size="small"
            aria-label={record.name}
            loading={toggleMutation.isPending}
            onChange={() => toggleMutation.mutate(record.id)}
          />
          <span className={val ? "queue-counter-toggle__label--active" : "queue-counter-toggle__label--paused"}>
            {val ? t("Queue:Counter:Active") : t("Queue:Counter:Paused")}
          </span>
        </span>
      ),
    },
    {
      title: t("Queue:Counter:Actions"),
      key: "actions",
      width: 60,
      align: "center",
      render: (_: unknown, record: ServiceCounter) => (
        <Tooltip title={t("Queue:Counter:Edit")}>
          <Button type="text" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)} />
        </Tooltip>
      ),
    },
  ];

  const saving = createMutation.isPending || updateMutation.isPending;

  return (
    <Modal
      title={t("Queue:Counter:Title")}
      open={open}
      onCancel={onClose}
      footer={null}
      width={600}
      destroyOnClose
    >
      <Form form={form} layout="vertical" className="queue-counter-form">
        <div className="queue-counter-form__row">
          <Form.Item
            name="name"
            label={t("Queue:Counter:Name")}
            rules={[{ required: true, message: t("Queue:Counter:NameRequired") }]}
            className="queue-counter-form__name"
          >
            <Input placeholder={t("Queue:Counter:NamePlaceholder")} />
          </Form.Item>
          <Space size={4}>
            <Button type="primary" onClick={handleSubmit} loading={saving} disabled={saving}>
              {editingId ? t("Queue:Counter:Update") : t("Queue:Counter:Add")}
            </Button>
            {editingId && (
              <Button onClick={handleCancel}>{t("Hủy")}</Button>
            )}
          </Space>
        </div>
      </Form>

      <Table<ServiceCounter>
        rowKey="id"
        columns={columns}
        dataSource={counters ?? []}
        loading={isLoading}
        pagination={false}
        size="small"
      />
    </Modal>
  );
}
