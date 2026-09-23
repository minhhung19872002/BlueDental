import { useState } from "react";
import { Button, Form, Input, Modal, Popconfirm, Space, Table, Tag } from "antd";
import { toast } from "sonner";
import { PillTabs } from "@/components/PillTabs";
import { PlusOutlined, EditOutlined, DeleteOutlined } from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import { t } from "@/lib/i18n";
import { PageHeader } from "@/components/PageHeader";
import { useAbility } from "@/hooks/useAbility";
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
  Active: "Organization:StatusActive",
  Inactive: "Organization:StatusInactive",
};

function BranchTable() {
  const { canCreate, canUpdate, canDelete } = useAbility("branchManager");
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
      toast.success(t("Organization:OrgUpdated"));
    } else {
      const createData: CreateClinicBranchDto = {
        code: values.code,
        name: values.name,
        address: values.address,
        phoneNumber: values.phoneNumber,
        email: values.email,
      };
      await createMutation.mutateAsync(createData);
      toast.success(t("Organization:OrgCreated"));
    }
    setModalOpen(false);
    form.resetFields();
  };

  const handleDelete = async (id: string) => {
    await deleteMutation.mutateAsync(id);
    toast.success(t("Organization:OrgDeleted"));
  };

  const columns: ColumnsType<ClinicBranchDto> = [
    { title: t("Organization:CodeCol"), dataIndex: "code", key: "code", width: 120 },
    { title: t("Organization:BranchNameCol"), dataIndex: "name", key: "name" },
    {
      title: t("Organization:AddressCol"),
      dataIndex: "address",
      key: "address",
      render: (v?: string) => v ?? "—",
    },
    {
      title: t("Organization:PhoneCol"),
      dataIndex: "phoneNumber",
      key: "phoneNumber",
      render: (v?: string) => v ?? "—",
    },
    {
      title: t("Common:Status"),
      dataIndex: "status",
      key: "status",
      render: (v: string) => (
        <Tag color={BRANCH_STATUS_COLOR[v] ?? "default"}>
          {BRANCH_STATUS_KEY[v] ? t(BRANCH_STATUS_KEY[v]) : v}
        </Tag>
      ),
    },
    ...((canUpdate || canDelete) ? [{
      title: t("Common:Actions"),
      key: "actions" as const,
      width: 120,
      fixed: "right" as const,
      render: (_: unknown, record: ClinicBranchDto) => (
        <Space>
          {canUpdate && (
            <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(record)} />
          )}
          {canDelete && (
            <Popconfirm
              title={t("Organization:BranchDelConfirm")}
              onConfirm={() => handleDelete(record.id)}
              okText={t("Organization:BranchDelOk")}
              cancelText={t("Organization:BranchDelCancel")}
            >
              <Button size="small" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          )}
        </Space>
      ),
    }] : []),
  ];

  return (
    <>
      <PageHeader
        title={t("Organization:BranchTabLabel")}
        subtitle={t("Organization:BranchPageSubtitle")}
      />

      {canCreate && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            {t("Organization:AddBranchBtn")}
          </Button>
        </div>
      )}
      <Table<ClinicBranchDto>
        rowKey="id"
        columns={columns}
        dataSource={data ?? []}
        loading={isLoading}
        pagination={{ pageSize: 10 }}
        size="middle"
        scroll={{ x: "max-content" }}
        locale={{ emptyText: t("Organization:NoBranches") }}
      />
      <Modal
        open={modalOpen}
        title={editingBranch ? t("Organization:UpdateBranch") : t("Organization:AddBranch")}
        onCancel={() => setModalOpen(false)}
        onOk={handleSave}
        confirmLoading={createMutation.isPending || updateMutation.isPending}
        okText={t("Organization:DeptSaveOk")}
        cancelText={t("Organization:DeptSaveCancel")}
        destroyOnClose
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="code"
            label={t("Organization:OrgCodeLabel")}
            rules={[{ required: true, message: t("Organization:OrgCodeRequired") }]}
          >
            <Input disabled={!!editingBranch} />
          </Form.Item>
          <Form.Item
            name="name"
            label={t("Organization:OrgNameLabel")}
            rules={[{ required: true, message: t("Organization:OrgNameRequired") }]}
          >
            <Input />
          </Form.Item>
          <Form.Item name="address" label={t("Organization:OrgAddressLabel")}>
            <Input />
          </Form.Item>
          <Form.Item name="phoneNumber" label={t("Organization:OrgPhoneLabel")}>
            <Input />
          </Form.Item>
          <Form.Item name="email" label={t("Organization:EmailLabel")}>
            <Input />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}

function DepartmentTable() {
  const { canCreate, canUpdate, canDelete } = useAbility("branchManager");
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
      toast.success(t("Organization:DeptUpdated"));
    } else {
      const createData: CreateDepartmentDto = {
        name: values.name,
        description: values.description,
      };
      await createMutation.mutateAsync(createData);
      toast.success(t("Organization:DeptCreated"));
    }
    setModalOpen(false);
    form.resetFields();
  };

  const handleDelete = async (id: string) => {
    await deleteMutation.mutateAsync(id);
    toast.success(t("Organization:DeptDeletedSuccess"));
  };

  const columns: ColumnsType<DepartmentDto> = [
    { title: t("Organization:DeptNameCol"), dataIndex: "name", key: "name" },
    {
      title: t("Common:Description"),
      dataIndex: "description",
      key: "description",
      render: (v?: string) => v ?? "—",
    },
    {
      title: t("Common:Status"),
      dataIndex: "isActive",
      key: "isActive",
      render: (v: boolean) => (
        <Tag color={v ? "green" : "default"}>{v ? t("Organization:StatusActive") : t("Organization:StatusInactive")}</Tag>
      ),
    },
    ...((canUpdate || canDelete) ? [{
      title: t("Common:Actions"),
      key: "actions" as const,
      width: 120,
      fixed: "right" as const,
      render: (_: unknown, record: DepartmentDto) => (
        <Space>
          {canUpdate && (
            <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(record)} />
          )}
          {canDelete && (
            <Popconfirm
              title={t("Organization:ConfirmDeleteDept")}
              onConfirm={() => handleDelete(record.id)}
              okText={t("Common:Confirm")}
              cancelText={t("Common:Cancel")}
            >
              <Button size="small" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          )}
        </Space>
      ),
    }] : []),
  ];

  return (
    <>
      {canCreate && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            {t("Organization:AddDeptBtn")}
          </Button>
        </div>
      )}
      <Table<DepartmentDto>
        rowKey="id"
        columns={columns}
        dataSource={data ?? []}
        loading={isLoading}
        pagination={{ pageSize: 10 }}
        size="middle"
        scroll={{ x: "max-content" }}
        locale={{ emptyText: t("Organization:NoDepts") }}
      />
      <Modal
        open={modalOpen}
        title={editingDept ? t("Organization:EditDeptTitle") : t("Organization:AddDeptBtn")}
        onCancel={() => setModalOpen(false)}
        onOk={handleSave}
        confirmLoading={createMutation.isPending || updateMutation.isPending}
        okText={t("Common:Save")}
        cancelText={t("Common:Cancel")}
        destroyOnClose
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="name"
            label={t("Organization:DeptNameCol")}
            rules={[{ required: true, message: t("Common:Required") }]}
          >
            <Input />
          </Form.Item>
          <Form.Item name="description" label={t("Common:Description")}>
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
      label: t("Organization:BranchPageTitle"),
      children: <BranchTable />,
    },
    {
      key: "departments",
      label: t("Organization:DeptTabLabel"),
      children: <DepartmentTable />,
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
          border: "1px solid var(--bd-line)",
        }}
      >
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "var(--bd-ink)" }}>
          {t("Organization:PageTitle")}
        </h2>
      </div>
      <div
        style={{
          background: "#fff",
          borderRadius: 10,
          border: "1px solid var(--bd-line)",
          padding: "0 20px",
        }}
      >
        <PillTabs items={tabItems} />
      </div>
    </div>
  );
}


