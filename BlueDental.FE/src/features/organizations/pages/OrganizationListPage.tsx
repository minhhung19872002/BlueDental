import { Table, Tag, Tabs } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useClinicBranches, useDepartments, type ClinicBranchDto, type DepartmentDto } from "../api";

const BRANCH_STATUS_COLOR: Record<string, string> = {
  Active:   "green",
  Inactive: "default",
};

const BRANCH_STATUS_LABEL: Record<string, string> = {
  Active:   "Hoạt động",
  Inactive: "Ngừng hoạt động",
};

function BranchTable() {
  const { data, isLoading } = useClinicBranches();

  const columns: ColumnsType<ClinicBranchDto> = [
    {
      title: "Mã",
      dataIndex: "code",
      key: "code",
      width: 120,
    },
    {
      title: "Tên chi nhánh",
      dataIndex: "name",
      key: "name",
    },
    {
      title: "Địa chỉ",
      dataIndex: "address",
      key: "address",
      render: (v?: string) => v ?? "—",
    },
    {
      title: "SĐT",
      dataIndex: "phoneNumber",
      key: "phoneNumber",
      render: (v?: string) => v ?? "—",
    },
    {
      title: "Trạng thái",
      dataIndex: "status",
      key: "status",
      render: (v: string) => (
        <Tag color={BRANCH_STATUS_COLOR[v] ?? "default"}>
          {BRANCH_STATUS_LABEL[v] ?? v}
        </Tag>
      ),
    },
  ];

  return (
    <Table<ClinicBranchDto>
      rowKey="id"
      columns={columns}
      dataSource={data ?? []}
      loading={isLoading}
      pagination={{ pageSize: 10 }}
      size="middle"
      locale={{ emptyText: "Chưa có chi nhánh nào" }}
    />
  );
}

function DepartmentTable() {
  const { data, isLoading } = useDepartments();

  const columns: ColumnsType<DepartmentDto> = [
    {
      title: "Tên phòng ban",
      dataIndex: "name",
      key: "name",
    },
    {
      title: "Mô tả",
      dataIndex: "description",
      key: "description",
      render: (v?: string) => v ?? "—",
    },
    {
      title: "Trạng thái",
      dataIndex: "isActive",
      key: "isActive",
      render: (v: boolean) => (
        <Tag color={v ? "green" : "default"}>{v ? "Hoạt động" : "Ngừng hoạt động"}</Tag>
      ),
    },
  ];

  return (
    <Table<DepartmentDto>
      rowKey="id"
      columns={columns}
      dataSource={data ?? []}
      loading={isLoading}
      pagination={{ pageSize: 10 }}
      size="middle"
      locale={{ emptyText: "Chưa có phòng ban nào" }}
    />
  );
}

export function OrganizationListPage() {
  const tabItems = [
    {
      key: "branches",
      label: "Chi nhánh",
      children: (
        <div style={{ paddingTop: 16 }}>
          <BranchTable />
        </div>
      ),
    },
    {
      key: "departments",
      label: "Phòng ban",
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
          Chi nhánh & Phòng ban
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
