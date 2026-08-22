import { useState } from "react";
import { Tabs, Table, Button, Input, Tag, Modal, Form, Select, message, Popconfirm, Switch } from "antd";
import { SearchOutlined, PlusOutlined, EditOutlined, DeleteOutlined, UserOutlined, SafetyOutlined } from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";
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
        message.success("Cập nhật người dùng thành công");
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
        message.success("Tạo người dùng thành công");
      }
      form.resetFields();
      onClose();
    } catch {
      // validation handled by antd
    }
  };

  return (
    <Modal
      title={isEdit ? "Chỉnh sửa người dùng" : "Tạo người dùng mới"}
      open={open}
      onCancel={() => { form.resetFields(); onClose(); }}
      onOk={handleOk}
      confirmLoading={createMutation.isPending || updateMutation.isPending}
      okText={isEdit ? "Lưu thay đổi" : "Tạo người dùng"}
      cancelText="Hủy"
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
        <Form.Item name="userName" label="Tên đăng nhập" rules={[{ required: true, message: "Nhập tên đăng nhập" }]}>
          <Input placeholder="username" disabled={isEdit} />
        </Form.Item>
        <Form.Item name="name" label="Họ và tên" rules={[{ required: true, message: "Nhập họ tên" }]}>
          <Input placeholder="Nguyễn Văn A" />
        </Form.Item>
        <Form.Item name="email" label="Email" rules={[{ required: true, type: "email", message: "Nhập email hợp lệ" }]}>
          <Input placeholder="user@example.com" />
        </Form.Item>
        <Form.Item name="phoneNumber" label="Số điện thoại">
          <Input placeholder="0901234567" />
        </Form.Item>
        {!isEdit && (
          <Form.Item name="password" label="Mật khẩu" rules={[{ required: true, min: 8, message: "Tối thiểu 8 ký tự" }]}>
            <Input.Password placeholder="Mật khẩu..." />
          </Form.Item>
        )}
        <Form.Item name="roleNames" label="Vai trò">
          <Select
            mode="multiple"
            placeholder="Chọn vai trò..."
            options={roleNames.map((r) => ({ value: r, label: r }))}
          />
        </Form.Item>
        <Form.Item name="isActive" label="Trạng thái" valuePropName="checked">
          <Switch checkedChildren="Hoạt động" unCheckedChildren="Vô hiệu" />
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
      message.success("Tạo vai trò thành công");
      form.resetFields();
      onClose();
    } catch {
      // antd validation
    }
  };

  return (
    <Modal
      title="Tạo vai trò mới"
      open={open}
      onCancel={() => { form.resetFields(); onClose(); }}
      onOk={handleOk}
      confirmLoading={createMutation.isPending}
      okText="Tạo vai trò"
      cancelText="Hủy"
      width={420}
      destroyOnClose
    >
      <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
        <Form.Item name="name" label="Tên vai trò" rules={[{ required: true, message: "Nhập tên vai trò" }]}>
          <Input placeholder="VD: admin, doctor, receptionist" />
        </Form.Item>
        <Form.Item name="isDefault" label="Mặc định" valuePropName="checked">
          <Switch checkedChildren="Có" unCheckedChildren="Không" />
        </Form.Item>
        <Form.Item name="isPublic" label="Công khai" valuePropName="checked" initialValue>
          <Switch checkedChildren="Có" unCheckedChildren="Không" defaultChecked />
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
      message.success("Xóa người dùng thành công");
    } catch {
      message.error("Xóa thất bại");
    }
  };

  const columns: ColumnsType<IdentityUserDto> = [
    { title: "Tên đăng nhập", dataIndex: "userName", key: "userName", width: 160 },
    { title: "Họ và tên", dataIndex: "name", key: "name" },
    { title: "Email", dataIndex: "email", key: "email" },
    { title: "Điện thoại", dataIndex: "phoneNumber", key: "phoneNumber", render: (v: string) => v ?? "—" },
    {
      title: "Vai trò",
      dataIndex: "roleNames",
      key: "roleNames",
      render: (roles: string[]) => (
        <>{(roles ?? []).map((r) => <Tag key={r} color="blue">{r}</Tag>)}</>
      ),
    },
    {
      title: "Trạng thái",
      dataIndex: "isActive",
      key: "isActive",
      render: (v: boolean) => <Tag color={v ? "green" : "default"}>{v ? "Hoạt động" : "Vô hiệu"}</Tag>,
    },
    {
      title: "Ngày tạo",
      dataIndex: "creationTime",
      key: "creationTime",
      render: (v: string) => dayjs(v).format("DD/MM/YYYY"),
    },
    {
      title: "Thao tác",
      key: "actions",
      width: 120,
      render: (_, record) => (
        <div style={{ display: "flex", gap: 6 }}>
          <Button size="small" icon={<EditOutlined />} onClick={() => { setEditingUser(record); setModalOpen(true); }} />
          <Popconfirm
            title="Xóa người dùng này?"
            onConfirm={() => handleDelete(record.id)}
            okText="Xóa"
            cancelText="Hủy"
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
            Tạo người dùng
          </Button>
          <Input
            prefix={<SearchOutlined />}
            placeholder="Tìm theo tên, email..."
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
          pagination={{ pageSize: 20, showTotal: (total) => `${total} người dùng` }}
          locale={{ emptyText: "Không có người dùng" }}
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
      message.success("Xóa vai trò thành công");
    } catch {
      message.error("Không thể xóa vai trò hệ thống");
    }
  };

  const columns: ColumnsType<IdentityRoleDto> = [
    { title: "Tên vai trò", dataIndex: "name", key: "name" },
    {
      title: "Mặc định",
      dataIndex: "isDefault",
      key: "isDefault",
      render: (v: boolean) => v ? <Tag color="blue">Mặc định</Tag> : "—",
    },
    {
      title: "Hệ thống",
      dataIndex: "isStatic",
      key: "isStatic",
      render: (v: boolean) => v ? <Tag color="orange">Tĩnh</Tag> : "—",
    },
    {
      title: "Công khai",
      dataIndex: "isPublic",
      key: "isPublic",
      render: (v: boolean) => <Tag color={v ? "green" : "default"}>{v ? "Công khai" : "Riêng tư"}</Tag>,
    },
    {
      title: "Thao tác",
      key: "actions",
      width: 100,
      render: (_, record) =>
        record.isStatic ? (
          <Tag>Không thể xóa</Tag>
        ) : (
          <Popconfirm
            title="Xóa vai trò này?"
            onConfirm={() => handleDelete(record.id)}
            okText="Xóa"
            cancelText="Hủy"
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
            Tạo vai trò
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
          locale={{ emptyText: "Không có vai trò" }}
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
      <div className="reception-card reception-card--toolbar">
        <div style={{ fontWeight: 700, fontSize: 18, color: "#1B2A41", marginBottom: 4 }}>
          Quản trị người dùng & vai trò
        </div>
        <div style={{ fontSize: 13, color: "#5A6B82" }}>
          Quản lý tài khoản, vai trò và phân quyền trong hệ thống
        </div>
      </div>
      <Tabs
        defaultActiveKey="users"
        style={{ background: "#fff", borderRadius: 10, padding: "0 16px" }}
        items={[
          {
            key: "users",
            label: (
              <span><UserOutlined style={{ marginRight: 6 }} />Người dùng</span>
            ),
            children: <UsersTab />,
          },
          {
            key: "roles",
            label: (
              <span><SafetyOutlined style={{ marginRight: 6 }} />Vai trò</span>
            ),
            children: <RolesTab />,
          },
        ]}
      />
    </div>
  );
}
