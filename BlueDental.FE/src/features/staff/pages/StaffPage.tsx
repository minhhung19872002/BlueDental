import { useState } from "react";
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

const STATUS_TABS: { key: StaffStatus; label: string }[] = [
  { key: "all",      label: "Tất cả" },
  { key: "working",  label: "Đang làm việc" },
  { key: "resigned", label: "Đã nghỉ" },
];

interface StaffModalProps {
  open: boolean;
  editing: StaffDto | null;
  onClose: () => void;
}

function StaffModal({ open, editing, onClose }: StaffModalProps) {
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
        message.success("Cập nhật thành công");
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
        message.success("Tạo nhân viên thành công");
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
      title={isEdit ? "Chỉnh sửa nhân viên" : "Thêm nhân viên mới"}
      okText={isEdit ? "Cập nhật" : "Tạo"}
      cancelText="Hủy"
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
            label="Tên đăng nhập"
            rules={[{ required: true, message: "Nhập tên đăng nhập" }]}
          >
            <Input placeholder="Tên đăng nhập..." />
          </Form.Item>
        )}
        <Form.Item name="name" label="Họ và tên" rules={[{ required: true, message: "Nhập họ tên" }]}>
          <Input placeholder="Nguyễn Văn A" />
        </Form.Item>
        <Form.Item name="email" label="Email" rules={[{ required: true, message: "Nhập email" }, { type: "email", message: "Email không hợp lệ" }]}>
          <Input placeholder="email@example.com" />
        </Form.Item>
        <Form.Item name="phoneNumber" label="Số điện thoại">
          <Input placeholder="0901234567" />
        </Form.Item>
        {!isEdit && (
          <Form.Item
            name="password"
            label="Mật khẩu"
            rules={[
              { required: true, message: "Nhập mật khẩu" },
              { min: 8, message: "Ít nhất 8 ký tự" },
            ]}
          >
            <Input.Password placeholder="Tối thiểu 8 ký tự..." />
          </Form.Item>
        )}
        <Form.Item name="roleNames" label="Vai trò">
          <Select
            mode="multiple"
            placeholder="Chọn vai trò..."
            options={roleOptions}
            allowClear
          />
        </Form.Item>
        {isEdit && (
          <Form.Item name="isActive" label="Trạng thái" valuePropName="checked">
            <Switch checkedChildren="Đang làm việc" unCheckedChildren="Đã nghỉ" />
          </Form.Item>
        )}
      </Form>
    </Modal>
  );
}

export function StaffPage() {
  const [statusTab, setStatusTab] = useState<StaffStatus>("all");
  const [keyword, setKeyword] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<StaffDto | null>(null);
  const debouncedKeyword = useDebounce(keyword);
  const deleteMutation = useDeleteStaff();

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
    message.success("Đã xóa nhân viên");
  };

  const columns = [
    {
      title: "Tên",
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
      title: "Số điện thoại",
      dataIndex: "phoneNumber",
      key: "phoneNumber",
      render: (v: string) => v || "—",
    },
    {
      title: "Email",
      dataIndex: "email",
      key: "email",
    },
    {
      title: "Phân quyền",
      dataIndex: "roleNames",
      key: "roleNames",
      render: (roles: string[]) =>
        roles.length > 0
          ? roles.map((r) => <Tag key={r} color="blue">{r}</Tag>)
          : <Tag color="default">—</Tag>,
    },
    {
      title: "Trạng thái",
      dataIndex: "isActive",
      key: "isActive",
      render: (active: boolean) => (
        <Tag color={active ? "green" : "default"}>{active ? "Đang làm việc" : "Đã nghỉ"}</Tag>
      ),
    },
    {
      title: "Thao tác",
      key: "actions",
      render: (_: unknown, record: StaffDto) => (
        <div style={{ display: "flex", gap: 8 }}>
          <Button size="small" onClick={() => handleEdit(record)}>Chỉnh sửa</Button>
          <Popconfirm
            title="Xóa nhân viên này?"
            okText="Xóa"
            cancelText="Hủy"
            okButtonProps={{ danger: true }}
            onConfirm={() => handleDelete(record.id)}
          >
            <Button size="small" danger>Xóa</Button>
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
            placeholder="Tìm theo tên, email, số điện thoại..."
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
            Thêm nhân viên
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
                `Hiển thị ${range[0]}–${range[1]} trên ${total} nhân viên`,
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
