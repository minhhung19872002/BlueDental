import { Table, Tag, Tabs } from "antd";
import { useTranslation } from "react-i18next";
import type { ColumnsType } from "antd/es/table";
import { useClinicBranches, useDepartments, type ClinicBranchDto, type DepartmentDto } from "../api";

const BRANCH_STATUS_COLOR: Record<string, string> = {
  Active:   "green",
  Inactive: "default",
};

const BRANCH_STATUS_KEY: Record<string, string> = {
  Active:   "common.active",
  Inactive: "common.inactive",
};

function BranchTable() {
  const { t } = useTranslation();
  const { data, isLoading } = useClinicBranches();

  const columns: ColumnsType<ClinicBranchDto> = [
    {
      title: t("organizations.branchCode"),
      dataIndex: "code",
      key: "code",
      width: 120,
    },
    {
      title: t("organizations.branchName"),
      dataIndex: "name",
      key: "name",
    },
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
  ];

  return (
    <Table<ClinicBranchDto>
      rowKey="id"
      columns={columns}
      dataSource={data ?? []}
      loading={isLoading}
      pagination={{ pageSize: 10 }}
      size="middle"
      locale={{ emptyText: t("organizations.noBranches") }}
    />
  );
}

function DepartmentTable() {
  const { t } = useTranslation();
  const { data, isLoading } = useDepartments();

  const columns: ColumnsType<DepartmentDto> = [
    {
      title: t("organizations.deptName"),
      dataIndex: "name",
      key: "name",
    },
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
  ];

  return (
    <Table<DepartmentDto>
      rowKey="id"
      columns={columns}
      dataSource={data ?? []}
      loading={isLoading}
      pagination={{ pageSize: 10 }}
      size="middle"
      locale={{ emptyText: t("organizations.noDepartments") }}
    />
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
