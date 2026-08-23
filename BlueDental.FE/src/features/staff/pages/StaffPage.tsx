import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Button, Form, Input, Modal, Select, Spin, Switch, Table, Tag, Popconfirm, message,
} from "antd";
import { SearchOutlined, PlusOutlined } from "@ant-design/icons";
import { useStaffList } from "../api/staffQueries";
import { useCreateStaff, useUpdateStaff, useDeleteStaff } from "../api/staffMutations";
import { useDebounce } from "@/hooks/useDebounce";
import { useIdentityRoleList } from "@/features/identity/api";
import type { StaffDto, CreateStaffInput, UpdateStaffInput } from "../api/staffApi";

type StaffStatus = "all" | "working" | "resigned";

interface StaffModalProps {
  open: boolean;
  editing: StaffDto | null;
  onClose: () => void;
}

function StaffModal({ open, editing, onClose }: StaffModalProps) {
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const createMutation = useCreateStaff();
  const updateMutation = useUpdateStaff();
  const { data: roleData } = useIdentityRoleList();
  const roleOptions = (roleData?.items ?? []).map((r) => ({ value: r.name, label: r.name }));
  const isEdit = Boolean(editing);

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      if (isEdit && editing) {
        const input: UpdateStaffInput = {
          name: values.name,
          email: values.email,
          phoneNumber: values.phoneNumber,
          roleNames: values.roleNames ?? [],
          isActive: values.isActive,
        };
        await updateMutation.mutateAsync({ id: editing.id, input });
        message.success(t("staff.updateSuccess"));
      } else {
        const input: CreateStaffInput = {
          userName: values.userName,
          name: values.name,
          email: values.email,
          phoneNumber: values.phoneNumber,
          password: values.password,
          roleNames: values.roleNames ?? [],
        };
        await createMutation.mutateAsync(input);
        message.success(t("staff.createSuccess"));
      }
      form.resetFields();
      onClose();
    } catch {
      // validation error or API error — handled by message in mutation
    }
  };

  const handleClose = () => {
    form.resetFields();
    onClose();
  };

  return (
    <Modal
      open={open}
      title={isEdit ? t("staff.editTitle") : t("staff.createTitle")}
      okText={isEdit ? t("common.update") : t("common.create")}
      cancelText={t("common.cancel")}
      onOk={handleOk}
      onCancel={handleClose}
      confirmLoading={createMutation.isPending || updateMutation.isPending}
      afterOpenChange={(visible) => {
        if (visible && editing) {
          form.setFieldsValue({
            userName: editing.userName,
            name: editing.name,
            email: editing.email,
            phoneNumber: editing.phoneNumber,
            roleNames: editing.roleNames,
            isActive: editing.isActive,
          });
        }
      }}
      width={500}
    >
      <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
        {!isEdit && (
          <Form.Item
            name="userName"
            label={t("staff.username")}
            rules={[{ required: true, message: t("staff.enterUsername") }]}
          >
            <Input placeholder={t("staff.enterUsername")} />
          </Form.Item>
        )}
        <Form.Item name="name" label={t("staff.fullName")} rules={[{ required: true, message: t("staff.enterFullName") }]}>
          <Input placeholder="Nguyễn Văn A" />
        </Form.Item>
        <Form.Item name="email" label={t("common.email")} rules={[{ required: true, message: t("staff.enterEmail") }, { type: "email", message: t("staff.invalidEmail") }]}>
          <Input placeholder="email@example.com" />
        </Form.Item>
        <Form.Item name="phoneNumber" label={t("common.phone")}>
          <Input placeholder="0901234567" />
        </Form.Item>
        {!isEdit && (
          <Form.Item
            name="password"
            label={t("staff.password")}
            rules={[
              { required: true, message: t("staff.enterPassword") },
              { min: 8, message: t("staff.minPassword") },
            ]}
          >
            <Input.Password placeholder={t("staff.minPassword")} />
          </Form.Item>
        )}
        <Form.Item name="roleNames" label={t("staff.role")}>
          <Select
            mode="multiple"
            placeholder={t("staff.selectRole")}
            options={roleOptions}
            allowClear
          />
        </Form.Item>
        {isEdit && (
          <Form.Item name="isActive" label={t("common.status")} valuePropName="checked">
            <Switch checkedChildren={t("staff.statusActive")} unCheckedChildren={t("staff.statusInactive")} />
          </Form.Item>
        )}
      </Form>
    </Modal>
  );
}

export function StaffPage() {
  const { t } = useTranslation();
  const [statusTab, setStatusTab] = useState<StaffStatus>("all");
  const [keyword, setKeyword] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<StaffDto | null>(null);
  const debouncedKeyword = useDebounce(keyword);
  const deleteMutation = useDeleteStaff();

  const STATUS_TABS: { key: StaffStatus; label: string }[] = [
    { key: "all",      label: t("common.all") },
    { key: "working",  label: t("staff.working") },
    { key: "resigned", label: t("staff.resigned") },
  ];

  const isActive = statusTab === "working" ? true : statusTab === "resigned" ? false : undefined;

  const { data, isLoading } = useStaffList({
    filter: debouncedKeyword || undefined,
    isActive,
    maxResultCount: 50,
  });

  const staff = data?.items ?? [];

  const handleEdit = (record: StaffDto) => {
    setEditing(record);
    setModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    await deleteMutation.mutateAsync(id);
    message.success(t("staff.deleteSuccess"));
  };

  const columns = [
    {
      title: t("common.name"),
      dataIndex: "name",
      key: "name",
      render: (name: string, record: StaffDto) => (
        <div>
          <div style={{ fontWeight: 500 }}>{name}</div>
          <div style={{ fontSize: 12, color: "#8c8c8c" }}>
            {record.roleNames.length > 0 ? record.roleNames.join(", ") : record.userName}
          </div>
        </div>
      ),
    },
    {
      title: t("common.phone"),
      dataIndex: "phoneNumber",
      key: "phoneNumber",
      render: (v: string) => v || "—",
    },
    {
      title: t("common.email"),
      dataIndex: "email",
      key: "email",
    },
    {
      title: t("staff.role"),
      dataIndex: "roleNames",
      key: "roleNames",
      render: (roles: string[]) =>
        roles.length > 0
          ? roles.map((r) => <Tag key={r} color="blue">{r}</Tag>)
          : <Tag color="default">—</Tag>,
    },
    {
      title: t("common.status"),
      dataIndex: "isActive",
      key: "isActive",
      render: (active: boolean) => (
        <Tag color={active ? "green" : "default"}>{active ? t("staff.working") : t("staff.resigned")}</Tag>
      ),
    },
    {
      title: t("common.actions"),
      key: "actions",
      render: (_: unknown, record: StaffDto) => (
        <div style={{ display: "flex", gap: 8 }}>
          <Button size="small" onClick={() => handleEdit(record)}>{t("common.edit")}</Button>
          <Popconfirm
            title={t("staff.confirmDelete")}
            okText={t("common.delete")}
            cancelText={t("common.cancel")}
            okButtonProps={{ danger: true }}
            onConfirm={() => handleDelete(record.id)}
          >
            <Button size="small" danger>{t("common.delete")}</Button>
          </Popconfirm>
        </div>
      ),
    },
  ];

  return (
    <div className="reception-page">
      <div className="reception-card reception-card--toolbar">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Input
            prefix={<SearchOutlined />}
            placeholder={t("staff.searchPlaceholder")}
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            style={{ width: 320 }}
            allowClear
          />
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => { setEditing(null); setModalOpen(true); }}
          >
            {t("staff.addStaff")}
          </Button>
        </div>
      </div>

      <div className="reception-card reception-card--tabs">
        <div style={{ display: "flex", gap: 0 }}>
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setStatusTab(tab.key)}
              style={{
                padding: "8px 20px",
                border: "none",
                borderBottom: statusTab === tab.key ? "2px solid #1677ff" : "2px solid transparent",
                background: "none",
                color: statusTab === tab.key ? "#1677ff" : "#595959",
                fontWeight: statusTab === tab.key ? 600 : 400,
                cursor: "pointer",
                fontSize: 14,
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="reception-card reception-card--content">
        {isLoading ? (
          <div style={{ textAlign: "center", padding: 48 }}><Spin /></div>
        ) : (
          <Table
            columns={columns}
            dataSource={staff}
            rowKey="id"
            pagination={{
              pageSize: 20,
              showSizeChanger: true,
              pageSizeOptions: ["10", "20", "50", "100"],
              showTotal: (total, range) =>
                t("staff.showRange", { from: range[0], to: range[1], total }),
            }}
            size="middle"
          />
        )}
      </div>

      <StaffModal
        open={modalOpen}
        editing={editing}
        onClose={() => { setModalOpen(false); setEditing(null); }}
      />
    </div>
  );
}
