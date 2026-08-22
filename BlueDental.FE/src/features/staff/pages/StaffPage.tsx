import { useState } from "react";
import { Button, Input, Spin, Table, Tag } from "antd";
import { SearchOutlined } from "@ant-design/icons";
import { useStaffList } from "../api/staffQueries";
import { useDebounce } from "@/hooks/useDebounce";
import type { StaffDto } from "../api/staffApi";

type StaffStatus = "all" | "working" | "resigned";

const STATUS_TABS: { key: StaffStatus; label: string }[] = [
  { key: "all",      label: "Tất cả" },
  { key: "working",  label: "Đang làm việc" },
  { key: "resigned", label: "Đã nghỉ" },
];

export function StaffPage() {
  const [statusTab, setStatusTab] = useState<StaffStatus>("all");
  const [keyword, setKeyword] = useState("");
  const debouncedKeyword = useDebounce(keyword);

  const isActive = statusTab === "working" ? true : statusTab === "resigned" ? false : undefined;

  const { data, isLoading } = useStaffList({
    filter: debouncedKeyword || undefined,
    isActive,
    maxResultCount: 50,
  });

  const staff = data?.items ?? [];

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
      render: () => (
        <div style={{ display: "flex", gap: 8 }}>
          <Button size="small">Chỉnh sửa</Button>
        </div>
      ),
    },
  ];

  return (
    <div className="reception-page">
      {/* Toolbar */}
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
          <Button type="primary">Tạo</Button>
        </div>
      </div>

      {/* Status tabs */}
      <div className="reception-card reception-card--tabs">
        <div style={{ display: "flex", gap: 0 }}>
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.key}
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

      {/* Table */}
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
            locale={{ emptyText: "Không có dữ liệu" }}
            size="middle"
          />
        )}
      </div>
    </div>
  );
}
