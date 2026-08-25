import { useState } from "react";
import { Table, Button, Input, Tag, Modal, Form, Select, Popconfirm, Switch } from "antd";
import { toast } from "sonner";
import { PillTabs } from "@/components/PillTabs";
import { SearchOutlined, PlusOutlined, EditOutlined, DeleteOutlined, UserOutlined, SafetyOutlined } from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";
import { t } from "@/lib/i18n";
import { PageHeader } from "@/components/PageHeader";
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
        toast.success(t("Cập nhật người dùng thành công"));
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
        toast.success(t("Tạo người dùng thành công"));
      }
      form.resetFields();
      onClose();
    } catch {
      // validation handled by antd
    }
  };

  return (
    <Modal
      title={isEdit ? t("Chỉnh sửa người dùng") : t("Tạo người dùng")}
      open={open}
      onCancel={() => { form.resetFields(); onClose(); }}
      onOk={handleOk}
      confirmLoading={createMutation.isPending || updateMutation.isPending}
      okText={isEdit ? t("Lưu thay đổi") : t("Tạo người dùng")}
      cancelText={t("Hủy")}
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
        <Form.Item name="userName" label={t("Tên đăng nhập")} rules={[{ required: true, message: t("Nhập tên đăng nhập") }]}>
          <Input placeholder="username" disabled={isEdit} />
        </Form.Item>
        <Form.Item name="name" label={t("Họ và tên")} rules={[{ required: true, message: t("Nhập họ tên") }]}>
          <Input placeholder={t("Nguyễn Văn A")} />
        </Form.Item>
        <Form.Item name="email" label="Email" rules={[{ required: true, type: "email", message: t("Nhập email hợp lệ") }]}>
          <Input placeholder="user@example.com" />
        </Form.Item>
        <Form.Item name="phoneNumber" label={t("Số điện thoại")}>
          <Input placeholder="0901234567" />
        </Form.Item>
        {!isEdit && (
          <Form.Item name="password" label={t("Mật khẩu")} rules={[{ required: true, min: 8, message: t("Tối thiểu 8 ký tự") }]}>
            <Input.Password placeholder={t("Mật khẩu...")} />
          </Form.Item>
        )}
        <Form.Item name="roleNames" label={t("Vai trò")}>
          <Select
            mode="multiple"
            placeholder={t("Chọn vai trò...")}
            options={roleNames.map((r) => ({ value: r, label: r }))}
          />
        </Form.Item>
        <Form.Item name="isActive" label={t("Trạng thái")} valuePropName="checked">
          <Switch checkedChildren={t("Hoạt động")} unCheckedChildren={t("Vô hiệu")} />
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
      toast.success(t("Tạo vai trò thành công"));
      form.resetFields();
      onClose();
    } catch {
      // antd validation
    }
  };

  return (
    <Modal
      title={t("Tạo vai trò")}
      open={open}
      onCancel={() => { form.resetFields(); onClose(); }}
      onOk={handleOk}
      confirmLoading={createMutation.isPending}
      okText={t("Tạo vai trò")}
      cancelText={t("Hủy")}
      width={420}
      destroyOnClose
    >
      <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
        <Form.Item name="name" label={t("Tên vai trò")} rules={[{ required: true, message: t("Nhập tên vai trò") }]}>
          <Input placeholder="VD: admin, doctor, receptionist" />
        </Form.Item>
        <Form.Item name="isDefault" label={t("Mặc định")} valuePropName="checked">
          <Switch checkedChildren={t("Có")} unCheckedChildren={t("Không")} />
        </Form.Item>
        <Form.Item name="isPublic" label={t("Công khai")} valuePropName="checked" initialValue>
          <Switch checkedChildren={t("Có")} unCheckedChildren={t("Không")} defaultChecked />
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

  const { data: usersData, isLoading } = useIdentityUserList({ filter: keyword || undefined });
  const { data: rolesData } = useIdentityRoleList();
  const deleteMutation = useDeleteIdentityUser();

  const roleNames = (rolesData?.items ?? []).map((r) => r.name);

  const handleDelete = async (id: string) => {
    try {
      await deleteMutation.mutateAsync(id);
      toast.success(t("Xóa người dùng thành công"));
    } catch {
      toast.error(t("Xóa thất bại"));
    }
  };

  const columns: ColumnsType<IdentityUserDto> = [
    { title: t("Tên đăng nhập"), dataIndex: "userName", key: "userName", width: 160 },
    { title: t("Họ và tên"), dataIndex: "name", key: "name" },
    { title: "Email", dataIndex: "email", key: "email" },
    { title: t("Số điện thoại"), dataIndex: "phoneNumber", key: "phoneNumber", render: (v: string) => v ?? "—" },
    {
      title: t("Vai trò"),
      dataIndex: "roleNames",
      key: "roleNames",
      render: (roles: string[]) => (
        <>{(roles ?? []).map((r) => <Tag key={r} color="blue">{r}</Tag>)}</>
      ),
    },
    {
      title: t("Trạng thái"),
      dataIndex: "isActive",
      key: "isActive",
      render: (v: boolean) => <Tag color={v ? "green" : "default"}>{v ? t("Hoạt động") : t("Vô hiệu")}</Tag>,
    },
    {
      title: t("Ngày tạo"),
      dataIndex: "creationTime",
      key: "creationTime",
      render: (v: string) => dayjs(v).format("DD/MM/YYYY"),
    },
    {
      title: t("Thao tác"),
      key: "actions",
      width: 120,
      render: (_, record) => (
        <div style={{ display: "flex", gap: 6 }}>
          <Button size="small" icon={<EditOutlined />} onClick={() => { setEditingUser(record); setModalOpen(true); }} />
          <Popconfirm
            title={t("Xóa người dùng này?")}
            onConfirm={() => handleDelete(record.id)}
            okText={t("Xóa")}
            cancelText={t("Hủy")}
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
            {t("Tạo người dùng")}
          </Button>
          <Input
            prefix={<SearchOutlined />}
            placeholder={t("Tìm theo tên, email...")}
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
          pagination={{ pageSize: 20, showTotal: (total) => t("{0} người dùng", total) }}
          locale={{ emptyText: t("Không có người dùng") }}
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

  const handleDelete = async (id: string) => {
    try {
      await deleteMutation.mutateAsync(id);
      toast.success(t("Xóa vai trò thành công"));
    } catch {
      toast.error(t("Không thể xóa vai trò hệ thống"));
    }
  };

  const columns: ColumnsType<IdentityRoleDto> = [
    { title: t("Tên vai trò"), dataIndex: "name", key: "name" },
    {
      title: t("Mặc định"),
      dataIndex: "isDefault",
      key: "isDefault",
      render: (v: boolean) => v ? <Tag color="blue">{t("Mặc định")}</Tag> : "—",
    },
    {
      title: t("Hệ thống"),
      dataIndex: "isStatic",
      key: "isStatic",
      render: (v: boolean) => v ? <Tag color="orange">{t("Tĩnh")}</Tag> : "—",
    },
    {
      title: t("Công khai"),
      dataIndex: "isPublic",
      key: "isPublic",
      render: (v: boolean) => <Tag color={v ? "green" : "default"}>{v ? t("Công khai") : t("Riêng tư")}</Tag>,
    },
    {
      title: t("Thao tác"),
      key: "actions",
      width: 100,
      render: (_, record) =>
        record.isStatic ? (
          <Tag>{t("Không thể xóa")}</Tag>
        ) : (
          <Popconfirm
            title={t("Xóa vai trò này?")}
            onConfirm={() => handleDelete(record.id)}
            okText={t("Xóa")}
            cancelText={t("Hủy")}
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
            {t("Tạo vai trò")}
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
          locale={{ emptyText: t("Không có vai trò") }}
          size="middle"
        />
      </div>
      <RoleModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────

export function IdentityAdministrationPage() {
  return (
    <div className="reception-page">
      <PageHeader
        title={t("Người dùng & vai trò")}
        subtitle={t("Tài khoản đăng nhập và phân quyền")}
      />

      <div className="reception-card reception-card--toolbar">
        <div style={{ fontWeight: 700, fontSize: 18, color: "var(--bd-ink)", marginBottom: 4 }}>
          {t("Quản trị người dùng & vai trò")}
        </div>
        <div style={{ fontSize: 13, color: "var(--bd-muted)" }}>
          {t("Quản lý tài khoản, vai trò và phân quyền trong hệ thống")}
        </div>
      </div>
      <PillTabs
        className="identity-tabs"
        defaultActiveKey="users"
        items={[
          {
            key: "users",
            label: (
              <span><UserOutlined style={{ marginRight: 6 }} />{t("Người dùng")}</span>
            ),
            children: <UsersTab />,
          },
          {
            key: "roles",
            label: (
              <span><SafetyOutlined style={{ marginRight: 6 }} />{t("Vai trò")}</span>
            ),
            children: <RolesTab />,
          },
        ]}
      />
    </div>
  );
}
