import { useState } from "react";
import { Tabs, Table, Button, Input, Tag, Modal, Form, Select, message, Popconfirm, Switch } from "antd";
import { SearchOutlined, PlusOutlined, EditOutlined, DeleteOutlined, UserOutlined, SafetyOutlined } from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";
import { useTranslation } from "react-i18next";
import {
  useIdentityUserList,
  useIdentityRoleList,
  useCreateIdentityUser,
  useUpdateIdentityUser,
  useDeleteIdentityUser,
  useCreateIdentityRole,
  useDeleteIdentityRole,
  type IdentityUserDto,
  type IdentityRoleDto,
  type CreateIdentityUserDto,
  type UpdateIdentityUserDto,
  type CreateIdentityRoleDto,
} from "../api";

// ── User Modal ─────────────────────────────────────────────────────────────

function UserModal({
  open,
  onClose,
  editingUser,
  roleNames,
}: {
  open: boolean;
  onClose: () => void;
  editingUser: IdentityUserDto | null;
  roleNames: string[];
}) {
  const { t } = useTranslation();
  const [form] = Form.useForm<CreateIdentityUserDto & UpdateIdentityUserDto>();
  const createMutation = useCreateIdentityUser();
  const updateMutation = useUpdateIdentityUser();
  const isEdit = Boolean(editingUser);

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      if (isEdit && editingUser) {
        await updateMutation.mutateAsync({
          id: editingUser.id,
          data: {
            userName: values.userName,
            name: values.name,
            email: values.email,
            phoneNumber: values.phoneNumber,
            roleNames: values.roleNames,
            isActive: values.isActive ?? true,
          } as UpdateIdentityUserDto,
        });
        message.success(t("identity.updateUserSuccess"));
      } else {
        await createMutation.mutateAsync({
          userName: values.userName,
          name: values.name,
          email: values.email,
          phoneNumber: values.phoneNumber,
          password: values.password,
          roleNames: values.roleNames,
          isActive: values.isActive ?? true,
        } as CreateIdentityUserDto);
        message.success(t("identity.createUserSuccess"));
      }
      form.resetFields();
      onClose();
    } catch {
      // validation handled by antd
    }
  };

  return (
    <Modal
      title={isEdit ? t("identity.editUser") : t("identity.createUser")}
      open={open}
      onCancel={() => { form.resetFields(); onClose(); }}
      onOk={handleOk}
      confirmLoading={createMutation.isPending || updateMutation.isPending}
      okText={isEdit ? t("identity.saveChanges") : t("identity.createUser")}
      cancelText={t("common.cancel")}
      width={520}
      destroyOnClose
      afterOpenChange={(visible) => {
        if (visible && editingUser) {
          form.setFieldsValue({
            userName: editingUser.userName,
            name: editingUser.name,
            email: editingUser.email,
            phoneNumber: editingUser.phoneNumber,
            roleNames: editingUser.roleNames,
            isActive: editingUser.isActive,
          });
        } else if (visible) {
          form.setFieldsValue({ isActive: true });
        }
      }}
    >
      <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
        <Form.Item name="userName" label={t("identity.username")} rules={[{ required: true, message: "Nhập tên đăng nhập" }]}>
          <Input placeholder="username" disabled={isEdit} />
        </Form.Item>
        <Form.Item name="name" label={t("identity.fullName")} rules={[{ required: true, message: "Nhập họ tên" }]}>
          <Input placeholder="Nguyễn Văn A" />
        </Form.Item>
        <Form.Item name="email" label="Email" rules={[{ required: true, type: "email", message: "Nhập email hợp lệ" }]}>
          <Input placeholder="user@example.com" />
        </Form.Item>
        <Form.Item name="phoneNumber" label={t("common.phone")}>
          <Input placeholder="0901234567" />
        </Form.Item>
        {!isEdit && (
          <Form.Item name="password" label={t("identity.password")} rules={[{ required: true, min: 8, message: "Tối thiểu 8 ký tự" }]}>
            <Input.Password placeholder={t("identity.passwordPlaceholder")} />
          </Form.Item>
        )}
        <Form.Item name="roleNames" label={t("identity.roles")}>
          <Select
            mode="multiple"
            placeholder={t("identity.selectRoles")}
            options={roleNames.map((r) => ({ value: r, label: r }))}
          />
        </Form.Item>
        <Form.Item name="isActive" label={t("common.status")} valuePropName="checked">
          <Switch checkedChildren={t("identity.active")} unCheckedChildren={t("identity.inactive")} />
        </Form.Item>
      </Form>
    </Modal>
  );
}

// ── Role Modal ─────────────────────────────────────────────────────────────

function RoleModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const [form] = Form.useForm<CreateIdentityRoleDto>();
  const createMutation = useCreateIdentityRole();

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      await createMutation.mutateAsync(values);
      message.success(t("identity.createRoleSuccess"));
      form.resetFields();
      onClose();
    } catch {
      // antd validation
    }
  };

  return (
    <Modal
      title={t("identity.createRole")}
      open={open}
      onCancel={() => { form.resetFields(); onClose(); }}
      onOk={handleOk}
      confirmLoading={createMutation.isPending}
      okText={t("identity.createRole")}
      cancelText={t("common.cancel")}
      width={420}
      destroyOnClose
    >
      <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
        <Form.Item name="name" label={t("identity.roleName")} rules={[{ required: true, message: "Nhập tên vai trò" }]}>
          <Input placeholder="VD: admin, doctor, receptionist" />
        </Form.Item>
        <Form.Item name="isDefault" label={t("identity.isDefault")} valuePropName="checked">
          <Switch checkedChildren={t("common.yes")} unCheckedChildren={t("common.no")} />
        </Form.Item>
        <Form.Item name="isPublic" label={t("identity.isPublic")} valuePropName="checked" initialValue>
          <Switch checkedChildren={t("common.yes")} unCheckedChildren={t("common.no")} defaultChecked />
        </Form.Item>
      </Form>
    </Modal>
  );
}

// ── Users Tab ──────────────────────────────────────────────────────────────

function UsersTab() {
  const { t } = useTranslation();
  const [keyword, setKeyword] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<IdentityUserDto | null>(null);

  const { data: usersData, isLoading } = useIdentityUserList({ filter: keyword || undefined });
  const { data: rolesData } = useIdentityRoleList();
  const deleteMutation = useDeleteIdentityUser();

  const roleNames = (rolesData?.items ?? []).map((r) => r.name);

  const handleDelete = async (id: string) => {
    try {
      await deleteMutation.mutateAsync(id);
      message.success(t("identity.deleteUserSuccess"));
    } catch {
      message.error(t("identity.deleteFailed"));
    }
  };

  const columns: ColumnsType<IdentityUserDto> = [
    { title: t("identity.username"), dataIndex: "userName", key: "userName", width: 160 },
    { title: t("identity.fullName"), dataIndex: "name", key: "name" },
    { title: "Email", dataIndex: "email", key: "email" },
    { title: t("common.phone"), dataIndex: "phoneNumber", key: "phoneNumber", render: (v: string) => v ?? "—" },
    {
      title: t("identity.roles"),
      dataIndex: "roleNames",
      key: "roleNames",
      render: (roles: string[]) => (
        <>{(roles ?? []).map((r) => <Tag key={r} color="blue">{r}</Tag>)}</>
      ),
    },
    {
      title: t("common.status"),
      dataIndex: "isActive",
      key: "isActive",
      render: (v: boolean) => <Tag color={v ? "green" : "default"}>{v ? t("identity.active") : t("identity.inactive")}</Tag>,
    },
    {
      title: t("identity.createdDate"),
      dataIndex: "creationTime",
      key: "creationTime",
      render: (v: string) => dayjs(v).format("DD/MM/YYYY"),
    },
    {
      title: t("common.actions"),
      key: "actions",
      width: 120,
      render: (_, record) => (
        <div style={{ display: "flex", gap: 6 }}>
          <Button size="small" icon={<EditOutlined />} onClick={() => { setEditingUser(record); setModalOpen(true); }} />
          <Popconfirm
            title={t("identity.deleteUserConfirm")}
            onConfirm={() => handleDelete(record.id)}
            okText={t("common.delete")}
            cancelText={t("common.cancel")}
            okButtonProps={{ danger: true }}
          >
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </div>
      ),
    },
  ];

  return (
    <>
      <div className="reception-card reception-card--toolbar">
        <div style={{ display: "flex", gap: 8, justifyContent: "space-between" }}>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => { setEditingUser(null); setModalOpen(true); }}
          >
            {t("identity.createUser")}
          </Button>
          <Input
            prefix={<SearchOutlined />}
            placeholder={t("identity.searchUserPlaceholder")}
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            style={{ width: 260 }}
            allowClear
          />
        </div>
      </div>
      <div className="reception-card reception-card--content">
        <Table<IdentityUserDto>
          rowKey="id"
          dataSource={usersData?.items ?? []}
          columns={columns}
          loading={isLoading}
          pagination={{ pageSize: 20, showTotal: (total) => t("identity.totalUsers", { total }) }}
          locale={{ emptyText: t("identity.noUsers") }}
          size="middle"
        />
      </div>
      <UserModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        editingUser={editingUser}
        roleNames={roleNames}
      />
    </>
  );
}

// ── Roles Tab ──────────────────────────────────────────────────────────────

function RolesTab() {
  const { t } = useTranslation();
  const [modalOpen, setModalOpen] = useState(false);
  const { data, isLoading } = useIdentityRoleList();
  const deleteMutation = useDeleteIdentityRole();

  const handleDelete = async (id: string) => {
    try {
      await deleteMutation.mutateAsync(id);
      message.success(t("identity.deleteRoleSuccess"));
    } catch {
      message.error(t("identity.deleteRoleFailed"));
    }
  };

  const columns: ColumnsType<IdentityRoleDto> = [
    { title: t("identity.roleName"), dataIndex: "name", key: "name" },
    {
      title: t("identity.isDefault"),
      dataIndex: "isDefault",
      key: "isDefault",
      render: (v: boolean) => v ? <Tag color="blue">{t("identity.isDefault")}</Tag> : "—",
    },
    {
      title: t("identity.isSystem"),
      dataIndex: "isStatic",
      key: "isStatic",
      render: (v: boolean) => v ? <Tag color="orange">{t("identity.static")}</Tag> : "—",
    },
    {
      title: t("identity.isPublic"),
      dataIndex: "isPublic",
      key: "isPublic",
      render: (v: boolean) => <Tag color={v ? "green" : "default"}>{v ? t("identity.public") : t("identity.private")}</Tag>,
    },
    {
      title: t("common.actions"),
      key: "actions",
      width: 100,
      render: (_, record) =>
        record.isStatic ? (
          <Tag>{t("identity.cannotDelete")}</Tag>
        ) : (
          <Popconfirm
            title={t("identity.deleteRoleConfirm")}
            onConfirm={() => handleDelete(record.id)}
            okText={t("common.delete")}
            cancelText={t("common.cancel")}
            okButtonProps={{ danger: true }}
          >
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        ),
    },
  ];

  return (
    <>
      <div className="reception-card reception-card--toolbar">
        <div style={{ display: "flex", gap: 8 }}>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>
            {t("identity.createRole")}
          </Button>
        </div>
      </div>
      <div className="reception-card reception-card--content">
        <Table<IdentityRoleDto>
          rowKey="id"
          dataSource={data?.items ?? []}
          columns={columns}
          loading={isLoading}
          pagination={false}
          locale={{ emptyText: t("identity.noRoles") }}
          size="middle"
        />
      </div>
      <RoleModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────

export function IdentityAdministrationPage() {
  const { t } = useTranslation();
  return (
    <div className="reception-page">
      <div className="reception-card reception-card--toolbar">
        <div style={{ fontWeight: 700, fontSize: 18, color: "#1B2A41", marginBottom: 4 }}>
          {t("identity.pageTitle")}
        </div>
        <div style={{ fontSize: 13, color: "#5A6B82" }}>
          {t("identity.pageSubtitle")}
        </div>
      </div>
      <Tabs
        defaultActiveKey="users"
        style={{ background: "#fff", borderRadius: 10, padding: "0 16px" }}
        items={[
          {
            key: "users",
            label: (
              <span><UserOutlined style={{ marginRight: 6 }} />{t("identity.tabUsers")}</span>
            ),
            children: <UsersTab />,
          },
          {
            key: "roles",
            label: (
              <span><SafetyOutlined style={{ marginRight: 6 }} />{t("identity.tabRoles")}</span>
            ),
            children: <RolesTab />,
          },
        ]}
      />
    </div>
  );
}
