import { useState } from "react";
import { Button, Form, Input, Modal, Popconfirm, Space, Table, Tag, Tabs, message } from "antd";
import { PlusOutlined, EditOutlined, DeleteOutlined } from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import { t } from "@/lib/i18n";
import { PageHeader } from "@/components/PageHeader";
import {
  useClinicBranches,
  useCreateBranch,
  useUpdateBranch,
  useDeleteBranch,
  useDepartments,
  useCreateDepartment,
  useUpdateDepartment,
  useDeleteDepartment,
  type ClinicBranchDto,
  type DepartmentDto,
  type CreateClinicBranchDto,
  type UpdateClinicBranchDto,
  type CreateDepartmentDto,
  type UpdateDepartmentDto,
} from "../api";

const BRANCH_STATUS_COLOR: Record<string, string> = {
  Active: "green",
  Inactive: "default",
};

const BRANCH_STATUS_KEY: Record<string, string> = {
  Active: "Đang hoạt động",
  Inactive: "Ngừng hoạt động",
};

function BranchTable() {
  const { data, isLoading } = useClinicBranches();
  const createMutation = useCreateBranch();
  const updateMutation = useUpdateBranch();
  const deleteMutation = useDeleteBranch();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<ClinicBranchDto | null>(null);
  const [form] = Form.useForm();

  const openCreate = () => {
    setEditingBranch(null);
    form.resetFields();
    setModalOpen(true);
  };

  const openEdit = (record: ClinicBranchDto) => {
    setEditingBranch(record);
    form.setFieldsValue({
      code: record.code,
      name: record.name,
      address: record.address,
      phoneNumber: record.phoneNumber,
      email: record.email,
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    const values = await form.validateFields();
    if (editingBranch) {
      const updateData: UpdateClinicBranchDto = {
        name: values.name,
        address: values.address,
        phoneNumber: values.phoneNumber,
        email: values.email,
      };
      await updateMutation.mutateAsync({ id: editingBranch.id, data: updateData });
      message.success(t("Cập nhật chi nhánh thành công"));
    } else {
      const createData: CreateClinicBranchDto = {
        code: values.code,
        name: values.name,
        address: values.address,
        phoneNumber: values.phoneNumber,
        email: values.email,
      };
      await createMutation.mutateAsync(createData);
      message.success(t("Tạo chi nhánh thành công"));
    }
    setModalOpen(false);
    form.resetFields();
  };

  const handleDelete = async (id: string) => {
    await deleteMutation.mutateAsync(id);
    message.success(t("Xóa chi nhánh thành công"));
  };

  const columns: ColumnsType<ClinicBranchDto> = [
    { title: t("Mã"), dataIndex: "code", key: "code", width: 120 },
    { title: t("Tên chi nhánh"), dataIndex: "name", key: "name" },
    {
      title: t("Địa chỉ"),
      dataIndex: "address",
      key: "address",
      render: (v?: string) => v ?? "—",
    },
    {
      title: t("Số điện thoại"),
      dataIndex: "phoneNumber",
      key: "phoneNumber",
      render: (v?: string) => v ?? "—",
    },
    {
      title: t("Trạng thái"),
      dataIndex: "status",
      key: "status",
      render: (v: string) => (
        <Tag color={BRANCH_STATUS_COLOR[v] ?? "default"}>
          {BRANCH_STATUS_KEY[v] ? t(BRANCH_STATUS_KEY[v]) : v}
        </Tag>
      ),
    },
    {
      title: t("Thao tác"),
      key: "actions",
      width: 120,
      render: (_: unknown, record: ClinicBranchDto) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(record)} />
          <Popconfirm
            title={t("Bạn có chắc muốn xóa chi nhánh này?")}
            onConfirm={() => handleDelete(record.id)}
            okText={t("Xác nhận")}
            cancelText={t("Hủy")}
          >
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title={t("Chi nhánh")}
        subtitle={t("Danh sách cơ sở của phòng khám")}
      />

      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
          {t("Thêm chi nhánh")}
        </Button>
      </div>
      <Table<ClinicBranchDto>
        rowKey="id"
        columns={columns}
        dataSource={data ?? []}
        loading={isLoading}
        pagination={{ pageSize: 10 }}
        size="middle"
        locale={{ emptyText: t("Chưa có chi nhánh nào") }}
      />
      <Modal
        open={modalOpen}
        title={editingBranch ? t("Sửa chi nhánh") : t("Thêm chi nhánh")}
        onCancel={() => setModalOpen(false)}
        onOk={handleSave}
        confirmLoading={createMutation.isPending || updateMutation.isPending}
        okText={t("Lưu")}
        cancelText={t("Hủy")}
        destroyOnClose
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="code"
            label={t("Mã")}
            rules={[{ required: true, message: t("Bắt buộc") }]}
          >
            <Input disabled={!!editingBranch} />
          </Form.Item>
          <Form.Item
            name="name"
            label={t("Tên chi nhánh")}
            rules={[{ required: true, message: t("Bắt buộc") }]}
          >
            <Input />
          </Form.Item>
          <Form.Item name="address" label={t("Địa chỉ")}>
            <Input />
          </Form.Item>
          <Form.Item name="phoneNumber" label={t("Số điện thoại")}>
            <Input />
          </Form.Item>
          <Form.Item name="email" label={t("Email")}>
            <Input />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}

function DepartmentTable() {
  const { data, isLoading } = useDepartments();
  const createMutation = useCreateDepartment();
  const updateMutation = useUpdateDepartment();
  const deleteMutation = useDeleteDepartment();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingDept, setEditingDept] = useState<DepartmentDto | null>(null);
  const [form] = Form.useForm();

  const openCreate = () => {
    setEditingDept(null);
    form.resetFields();
    setModalOpen(true);
  };

  const openEdit = (record: DepartmentDto) => {
    setEditingDept(record);
    form.setFieldsValue({ name: record.name, description: record.description });
    setModalOpen(true);
  };

  const handleSave = async () => {
    const values = await form.validateFields();
    if (editingDept) {
      const updateData: UpdateDepartmentDto = {
        name: values.name,
        description: values.description,
      };
      await updateMutation.mutateAsync({ id: editingDept.id, data: updateData });
      message.success(t("Cập nhật phòng ban thành công"));
    } else {
      const createData: CreateDepartmentDto = {
        name: values.name,
        description: values.description,
      };
      await createMutation.mutateAsync(createData);
      message.success(t("Tạo phòng ban thành công"));
    }
    setModalOpen(false);
    form.resetFields();
  };

  const handleDelete = async (id: string) => {
    await deleteMutation.mutateAsync(id);
    message.success(t("Xóa phòng ban thành công"));
  };

  const columns: ColumnsType<DepartmentDto> = [
    { title: t("Tên phòng ban"), dataIndex: "name", key: "name" },
    {
      title: t("Mô tả"),
      dataIndex: "description",
      key: "description",
      render: (v?: string) => v ?? "—",
    },
    {
      title: t("Trạng thái"),
      dataIndex: "isActive",
      key: "isActive",
      render: (v: boolean) => (
        <Tag color={v ? "green" : "default"}>{v ? t("Đang hoạt động") : t("Ngừng hoạt động")}</Tag>
      ),
    },
    {
      title: t("Thao tác"),
      key: "actions",
      width: 120,
      render: (_: unknown, record: DepartmentDto) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(record)} />
          <Popconfirm
            title={t("Bạn có chắc muốn xóa phòng ban này?")}
            onConfirm={() => handleDelete(record.id)}
            okText={t("Xác nhận")}
            cancelText={t("Hủy")}
          >
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
          {t("Thêm phòng ban")}
        </Button>
      </div>
      <Table<DepartmentDto>
        rowKey="id"
        columns={columns}
        dataSource={data ?? []}
        loading={isLoading}
        pagination={{ pageSize: 10 }}
        size="middle"
        locale={{ emptyText: t("Chưa có phòng ban nào") }}
      />
      <Modal
        open={modalOpen}
        title={editingDept ? t("Sửa phòng ban") : t("Thêm phòng ban")}
        onCancel={() => setModalOpen(false)}
        onOk={handleSave}
        confirmLoading={createMutation.isPending || updateMutation.isPending}
        okText={t("Lưu")}
        cancelText={t("Hủy")}
        destroyOnClose
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="name"
            label={t("Tên phòng ban")}
            rules={[{ required: true, message: t("Bắt buộc") }]}
          >
            <Input />
          </Form.Item>
          <Form.Item name="description" label={t("Mô tả")}>
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}

export function OrganizationListPage() {
  const tabItems = [
    {
      key: "branches",
      label: t("Chi nhánh"),
      children: (
        <div style={{ paddingTop: 16 }}>
          <BranchTable />
        </div>
      ),
    },
    {
      key: "departments",
      label: t("Phòng ban"),
      children: (
        <div style={{ paddingTop: 16 }}>
          <DepartmentTable />
        </div>
      ),
    },
  ];

  return (
    <div>
      <div
        style={{
          background: "#fff",
          borderRadius: 10,
          padding: "16px 20px",
          marginBottom: 16,
          border: "1px solid #E5E7EB",
        }}
      >
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#1B2A41" }}>
          {t("Chi nhánh & Phòng ban")}
        </h2>
      </div>
      <div
        style={{
          background: "#fff",
          borderRadius: 10,
          border: "1px solid #E5E7EB",
          padding: "0 20px",
        }}
      >
        <Tabs items={tabItems} />
      </div>
    </div>
  );
}
