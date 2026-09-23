import { useMemo, useState } from "react";
import { Table, Button, Input, Tag, Modal, Form, Select, Popconfirm, Switch } from "antd";
import { toast } from "sonner";
import { PillTabs } from "@/components/PillTabs";
import { SearchOutlined, PlusOutlined, EditOutlined, DeleteOutlined, UserOutlined, SafetyOutlined } from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";
import { t } from "@/lib/i18n";
import { PageHeader } from "@/components/PageHeader";
import { useAuthStore } from "@/features/auth/store/authStore";
import { LegacyPermissions } from "@/lib/permissionConstants";
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
        toast.success(t("Identity:UpdateUserSuccess"));
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
        toast.success(t("Identity:CreateUserSuccess"));
      }
      form.resetFields();
      onClose();
    } catch {
      // validation handled by antd
    }
  };

  return (
    <Modal
      title={isEdit ? t("Identity:EditUser") : t("Identity:CreateUser")}
      open={open}
      onCancel={() => { form.resetFields(); onClose(); }}
      onOk={handleOk}
      confirmLoading={createMutation.isPending || updateMutation.isPending}
      okText={isEdit ? t("Identity:SaveChanges") : t("Identity:CreateUser")}
      cancelText={t("Common:Cancel")}
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
        <Form.Item name="userName" label={t("Identity:UserName")} rules={[{ required: true, message: t("Identity:UserNamePlaceholder") }]}>
          <Input placeholder="username" disabled={isEdit} />
        </Form.Item>
        <Form.Item name="name" label={t("Identity:FullName")} rules={[{ required: true, message: t("Identity:FullNamePlaceholder") }]}>
          <Input placeholder={t("Identity:FullNameExample")} />
        </Form.Item>
        <Form.Item name="email" label={t("Identity:Email")} rules={[{ required: true, type: "email", message: t("Identity:EmailPlaceholder") }]}>
          <Input placeholder="user@example.com" />
        </Form.Item>
        <Form.Item name="phoneNumber" label={t("Identity:Phone")}>
          <Input placeholder="0901234567" />
        </Form.Item>
        {!isEdit && (
          <Form.Item name="password" label={t("Identity:Password")} rules={[{ required: true, min: 8, message: t("Identity:PasswordMinLength") }]}>
            <Input.Password placeholder={t("Identity:PasswordPlaceholder")} />
          </Form.Item>
        )}
        <Form.Item name="roleNames" label={t("Identity:Roles")}>
          <Select
            mode="multiple"
            placeholder={t("Identity:RolesPlaceholder")}
            options={roleNames.map((r) => ({ value: r, label: r }))}
          />
        </Form.Item>
        <Form.Item name="isActive" label={t("Identity:ActiveStatus")} valuePropName="checked">
          <Switch checkedChildren={t("Identity:Active")} unCheckedChildren={t("Identity:Inactive")} />
        </Form.Item>
      </Form>
    </Modal>
  );
}

// ── Role Modal ─────────────────────────────────────────────────────────────

function RoleModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [form] = Form.useForm<CreateIdentityRoleDto>();
  const createMutation = useCreateIdentityRole();

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      await createMutation.mutateAsync(values);
      toast.success(t("Identity:CreateRoleSuccess"));
      form.resetFields();
      onClose();
    } catch {
      // antd validation
    }
  };

  return (
    <Modal
      title={t("Identity:CreateRole")}
      open={open}
      onCancel={() => { form.resetFields(); onClose(); }}
      onOk={handleOk}
      confirmLoading={createMutation.isPending}
      okText={t("Identity:CreateRole")}
      cancelText={t("Common:Cancel")}
      width={420}
      destroyOnClose
    >
      <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
        <Form.Item name="name" label={t("Identity:RoleName")} rules={[{ required: true, message: t("Identity:RoleNamePlaceholder") }]}>
          <Input placeholder={t("VD: admin, doctor, receptionist")} />
        </Form.Item>
        <Form.Item name="isDefault" label={t("Identity:IsDefault")} valuePropName="checked">
          <Switch checkedChildren={t("Identity:Yes")} unCheckedChildren={t("Identity:No")} />
        </Form.Item>
        <Form.Item name="isPublic" label={t("Identity:IsPublic")} valuePropName="checked" initialValue>
          <Switch checkedChildren={t("Identity:Yes")} unCheckedChildren={t("Identity:No")} defaultChecked />
        </Form.Item>
      </Form>
    </Modal>
  );
}

// ── Users Tab ──────────────────────────────────────────────────────────────

function UsersTab() {
  const [keyword, setKeyword] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<IdentityUserDto | null>(null);

  const hasPermission = useAuthStore((s) => s.hasPermission);
  const canCreateUser = hasPermission(LegacyPermissions.SystemAdmin.UsersCreate);
  const canEditUser = hasPermission(LegacyPermissions.SystemAdmin.UsersEdit);
  const canDeleteUser = hasPermission(LegacyPermissions.SystemAdmin.UsersDelete);

  const { data: usersData, isLoading } = useIdentityUserList({ filter: keyword || undefined });
  const { data: rolesData } = useIdentityRoleList();
  const deleteMutation = useDeleteIdentityUser();

  const roleNames = (rolesData?.items ?? []).map((r) => r.name);

  const handleDelete = async (id: string) => {
    try {
      await deleteMutation.mutateAsync(id);
      toast.success(t("Identity:DeleteUserSuccess"));
    } catch {
      toast.error(t("Identity:DeleteUserFailed"));
    }
  };

  const columns: ColumnsType<IdentityUserDto> = [
    { title: t("Identity:ColUserName"), dataIndex: "userName", key: "userName", width: 160 },
    { title: t("Identity:ColFullName"), dataIndex: "name", key: "name" },
    { title: t("Identity:ColEmail"), dataIndex: "email", key: "email" },
    { title: t("Identity:ColPhone"), dataIndex: "phoneNumber", key: "phoneNumber", render: (v: string) => v ?? "—" },
    {
      title: t("Identity:ColRoles"),
      dataIndex: "roleNames",
      key: "roleNames",
      render: (roles: string[]) => (
        <>{(roles ?? []).map((r) => <Tag key={r} color="blue">{r}</Tag>)}</>
      ),
    },
    {
      title: t("Identity:ColStatus"),
      dataIndex: "isActive",
      key: "isActive",
      render: (v: boolean) => <Tag color={v ? "green" : "default"}>{v ? t("Identity:Active") : t("Identity:Inactive")}</Tag>,
    },
    {
      title: t("Identity:ColCreatedAt"),
      dataIndex: "creationTime",
      key: "creationTime",
      render: (v: string) => dayjs(v).format("DD/MM/YYYY"),
    },
    ...((canEditUser || canDeleteUser) ? [{
      title: t("Common:Actions"),
      key: "actions" as const,
      width: 120,
      fixed: "right" as const,
      render: (_: unknown, record: IdentityUserDto) => (
        <div style={{ display: "flex", gap: 6 }}>
          {canEditUser && (
            <Button size="small" icon={<EditOutlined />} onClick={() => { setEditingUser(record); setModalOpen(true); }} />
          )}
          {canDeleteUser && (
            <Popconfirm
              title={t("Identity:DeleteUserConfirm")}
              onConfirm={() => handleDelete(record.id)}
              okText={t("Common:Delete")}
              cancelText={t("Common:Cancel")}
              okButtonProps={{ danger: true }}
            >
              <Button size="small" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          )}
        </div>
      ),
    }] : []),
  ];

  return (
    <>
      <div className="reception-card reception-card--toolbar">
        <div style={{ display: "flex", gap: 8, justifyContent: "space-between" }}>
          {canCreateUser && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => { setEditingUser(null); setModalOpen(true); }}
            >
              {t("Identity:CreateUser")}
            </Button>
          )}
          <Input
            prefix={<SearchOutlined />}
            placeholder={t("Identity:SearchPlaceholder")}
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
          pagination={{ pageSize: 20, showTotal: (total) => t("Identity:UserCount", total) }}
          locale={{ emptyText: t("Identity:NoUser") }}
          scroll={{ x: "max-content" }}
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
  const [modalOpen, setModalOpen] = useState(false);
  const { data, isLoading } = useIdentityRoleList();
  const deleteMutation = useDeleteIdentityRole();

  const hasPermission = useAuthStore((s) => s.hasPermission);
  const canCreateRole = hasPermission(LegacyPermissions.SystemAdmin.RolesCreate);
  const canDeleteRole = hasPermission(LegacyPermissions.SystemAdmin.RolesDelete);

  const handleDelete = async (id: string) => {
    try {
      await deleteMutation.mutateAsync(id);
      toast.success(t("Identity:DeleteRoleSuccess"));
    } catch {
      toast.error(t("Identity:DeleteRoleFailed"));
    }
  };

  const columns: ColumnsType<IdentityRoleDto> = [
    { title: t("Identity:ColRoleName"), dataIndex: "name", key: "name" },
    {
      title: t("Identity:ColIsDefault"),
      dataIndex: "isDefault",
      key: "isDefault",
      render: (v: boolean) => v ? <Tag color="blue">{t("Identity:IsDefault")}</Tag> : "—",
    },
    {
      title: t("Identity:ColIsSystem"),
      dataIndex: "isStatic",
      key: "isStatic",
      render: (v: boolean) => v ? <Tag color="orange">{t("Identity:Static")}</Tag> : "—",
    },
    {
      title: t("Identity:ColIsPublic"),
      dataIndex: "isPublic",
      key: "isPublic",
      render: (v: boolean) => <Tag color={v ? "green" : "default"}>{v ? t("Identity:Public") : t("Identity:Private")}</Tag>,
    },
    {
      title: t("Common:Actions"),
      key: "actions",
      width: 100,
      fixed: "right",
      render: (_, record) =>
        record.isStatic ? (
          <Tag>{t("Identity:CannotDelete")}</Tag>
        ) : canDeleteRole ? (
          <Popconfirm
            title={t("Identity:DeleteRoleConfirm")}
            onConfirm={() => handleDelete(record.id)}
            okText={t("Common:Delete")}
            cancelText={t("Common:Cancel")}
            okButtonProps={{ danger: true }}
          >
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        ) : null,
    },
  ];

  return (
    <>
      <div className="reception-card reception-card--toolbar">
        <div style={{ display: "flex", gap: 8 }}>
          {canCreateRole && (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>
              {t("Identity:CreateRole")}
            </Button>
          )}
        </div>
      </div>
      <div className="reception-card reception-card--content">
        <Table<IdentityRoleDto>
          rowKey="id"
          dataSource={data?.items ?? []}
          columns={columns}
          loading={isLoading}
          pagination={false}
          locale={{ emptyText: t("Identity:NoRole") }}
          scroll={{ x: "max-content" }}
          size="middle"
        />
      </div>
      <RoleModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────

export function IdentityAdministrationPage() {
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const canUsers = hasPermission(LegacyPermissions.SystemAdmin.Users);
  const canRoles = hasPermission(LegacyPermissions.SystemAdmin.Roles);

  const items = useMemo(() => {
    const all: Array<{ key: string; label: React.ReactNode; children: React.ReactNode }> = [];
    if (canUsers) {
      all.push({
        key: "users",
        label: <span><UserOutlined style={{ marginRight: 6 }} />{t("Identity:UsersTab")}</span>,
        children: <UsersTab />,
      });
    }
    if (canRoles) {
      all.push({
        key: "roles",
        label: <span><SafetyOutlined style={{ marginRight: 6 }} />{t("Identity:RolesTab")}</span>,
        children: <RolesTab />,
      });
    }
    return all;
  }, [canUsers, canRoles]);

  return (
    <div className="reception-page">
      <PageHeader
        title={t("Identity:PageTitle")}
        subtitle={t("Identity:PageSubtitle")}
      />

      <div className="reception-card reception-card--toolbar">
        <div style={{ fontWeight: 700, fontSize: 18, color: "var(--bd-ink)", marginBottom: 4 }}>
          {t("Identity:AdminTitle")}
        </div>
        <div style={{ fontSize: 13, color: "var(--bd-muted)" }}>
          {t("Identity:AdminSubtitle")}
        </div>
      </div>
      <PillTabs
        className="identity-tabs"
        defaultActiveKey={items[0]?.key ?? "users"}
        items={items}
      />
    </div>
  );
}
