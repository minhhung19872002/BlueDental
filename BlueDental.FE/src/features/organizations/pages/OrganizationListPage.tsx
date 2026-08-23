import { useState } from "react";
import { Button, Form, Input, Modal, Popconfirm, Space, Table, Tag, Tabs, message } from "antd";
import { PlusOutlined, EditOutlined, DeleteOutlined } from "@ant-design/icons";
import { useTranslation } from "react-i18next";
import type { ColumnsType } from "antd/es/table";
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
  Active: "common.active",
  Inactive: "common.inactive",
};

function BranchTable() {
  const { t } = useTranslation();
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
      message.success(t("organizations.updateSuccess"));
    } else {
      const createData: CreateClinicBranchDto = {
        code: values.code,
        name: values.name,
        address: values.address,
        phoneNumber: values.phoneNumber,
        email: values.email,
      };
      await createMutation.mutateAsync(createData);
      message.success(t("organizations.createSuccess"));
    }
    setModalOpen(false);
    form.resetFields();
  };

  const handleDelete = async (id: string) => {
    await deleteMutation.mutateAsync(id);
    message.success(t("organizations.deleteSuccess"));
  };

  const columns: ColumnsType<ClinicBranchDto> = [
    { title: t("organizations.branchCode"), dataIndex: "code", key: "code", width: 120 },
    { title: t("organizations.branchName"), dataIndex: "name", key: "name" },
    {
      title: t("organizations.address"),
      dataIndex: "address",
      key: "address",
      render: (v?: string) => v ?? "—",
    },
    {
      title: t("common.phone"),
      dataIndex: "phoneNumber",
      key: "phoneNumber",
      render: (v?: string) => v ?? "—",
    },
    {
      title: t("common.status"),
      dataIndex: "status",
      key: "status",
      render: (v: string) => (
        <Tag color={BRANCH_STATUS_COLOR[v] ?? "default"}>
          {BRANCH_STATUS_KEY[v] ? t(BRANCH_STATUS_KEY[v]) : v}
        </Tag>
      ),
    },
    {
      title: t("common.actions"),
      key: "actions",
      width: 120,
      render: (_: unknown, record: ClinicBranchDto) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(record)} />
          <Popconfirm
            title={t("organizations.confirmDeleteBranch")}
            onConfirm={() => handleDelete(record.id)}
            okText={t("common.confirm")}
            cancelText={t("common.cancel")}
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
          {t("organizations.addBranch")}
        </Button>
      </div>
      <Table<ClinicBranchDto>
        rowKey="id"
        columns={columns}
        dataSource={data ?? []}
        loading={isLoading}
        pagination={{ pageSize: 10 }}
        size="middle"
        locale={{ emptyText: t("organizations.noBranches") }}
      />
      <Modal
        open={modalOpen}
        title={editingBranch ? t("organizations.editBranch") : t("organizations.addBranch")}
        onCancel={() => setModalOpen(false)}
        onOk={handleSave}
        confirmLoading={createMutation.isPending || updateMutation.isPending}
        okText={t("common.save")}
        cancelText={t("common.cancel")}
        destroyOnClose
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="code"
            label={t("organizations.branchCode")}
            rules={[{ required: true, message: t("common.required") }]}
          >
            <Input disabled={!!editingBranch} />
          </Form.Item>
          <Form.Item
            name="name"
            label={t("organizations.branchName")}
            rules={[{ required: true, message: t("common.required") }]}
          >
            <Input />
          </Form.Item>
          <Form.Item name="address" label={t("organizations.address")}>
            <Input />
          </Form.Item>
          <Form.Item name="phoneNumber" label={t("common.phone")}>
            <Input />
          </Form.Item>
          <Form.Item name="email" label={t("common.email")}>
            <Input />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}

function DepartmentTable() {
  const { t } = useTranslation();
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
      message.success(t("organizations.updateDeptSuccess"));
    } else {
      const createData: CreateDepartmentDto = {
        name: values.name,
        description: values.description,
      };
      await createMutation.mutateAsync(createData);
      message.success(t("organizations.createDeptSuccess"));
    }
    setModalOpen(false);
    form.resetFields();
  };

  const handleDelete = async (id: string) => {
    await deleteMutation.mutateAsync(id);
    message.success(t("organizations.deleteDeptSuccess"));
  };

  const columns: ColumnsType<DepartmentDto> = [
    { title: t("organizations.deptName"), dataIndex: "name", key: "name" },
    {
      title: t("common.description"),
      dataIndex: "description",
      key: "description",
      render: (v?: string) => v ?? "—",
    },
    {
      title: t("common.status"),
      dataIndex: "isActive",
      key: "isActive",
      render: (v: boolean) => (
        <Tag color={v ? "green" : "default"}>{v ? t("common.active") : t("common.inactive")}</Tag>
      ),
    },
    {
      title: t("common.actions"),
      key: "actions",
      width: 120,
      render: (_: unknown, record: DepartmentDto) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(record)} />
          <Popconfirm
            title={t("organizations.confirmDeleteDept")}
            onConfirm={() => handleDelete(record.id)}
            okText={t("common.confirm")}
            cancelText={t("common.cancel")}
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
          {t("organizations.addDept")}
        </Button>
      </div>
      <Table<DepartmentDto>
        rowKey="id"
        columns={columns}
        dataSource={data ?? []}
        loading={isLoading}
        pagination={{ pageSize: 10 }}
        size="middle"
        locale={{ emptyText: t("organizations.noDepartments") }}
      />
      <Modal
        open={modalOpen}
        title={editingDept ? t("organizations.editDept") : t("organizations.addDept")}
        onCancel={() => setModalOpen(false)}
        onOk={handleSave}
        confirmLoading={createMutation.isPending || updateMutation.isPending}
        okText={t("common.save")}
        cancelText={t("common.cancel")}
        destroyOnClose
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="name"
            label={t("organizations.deptName")}
            rules={[{ required: true, message: t("common.required") }]}
          >
            <Input />
          </Form.Item>
          <Form.Item name="description" label={t("common.description")}>
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}

export function OrganizationListPage() {
  const { t } = useTranslation();
  const tabItems = [
    {
      key: "branches",
      label: t("organizations.branches"),
      children: (
        <div style={{ paddingTop: 16 }}>
          <BranchTable />
        </div>
      ),
    },
    {
      key: "departments",
      label: t("organizations.departments"),
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
          {t("organizations.title")}
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
