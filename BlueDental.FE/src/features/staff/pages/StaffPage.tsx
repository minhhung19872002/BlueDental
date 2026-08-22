import { useState } from "react";
import { Button, Input, Table, Tag } from "antd";
import { SearchOutlined } from "@ant-design/icons";

// ── Types ──────────────────────────────────────────────────────────────────

type StaffStatus = "all" | "working" | "resigned";

interface StaffMember {
  id: string;
  name: string;
  phone: string;
  email: string;
  role: string;
  address: string;
  status: "working" | "resigned";
}

// ── Synthetic data ─────────────────────────────────────────────────────────

const SYNTHETIC_STAFF: StaffMember[] = [
  {
    id: "1",
    name: "KT Dung",
    phone: "0773678836",
    email: "ktdung@bluedental.vn",
    role: "Kế Toán",
    address: "—",
    status: "working",
  },
  {
    id: "2",
    name: "Bs Tới 2",
    phone: "—",
    email: "bstoi2@bluedental.vn",
    role: "Bác Sĩ Điều Trị",
    address: "—",
    status: "working",
  },
  {
    id: "3",
    name: "Lễ Tân DH",
    phone: "—",
    email: "letandh@bluedental.vn",
    role: "Lễ Tân",
    address: "—",
    status: "working",
  },
  {
    id: "4",
    name: "BS Tới",
    phone: "—",
    email: "bstoi@bluedental.vn",
    role: "Bác Sĩ Điều Trị",
    address: "—",
    status: "working",
  },
  {
    id: "5",
    name: "BS Tới 1",
    phone: "—",
    email: "bstoi1@bluedental.vn",
    role: "Bác Sĩ Điều Trị",
    address: "—",
    status: "working",
  },
  {
    id: "6",
    name: "BS Tới 3",
    phone: "—",
    email: "bstoi3@bluedental.vn",
    role: "Bác Sĩ Điều Trị",
    address: "—",
    status: "working",
  },
  {
    id: "7",
    name: "BS Tới 10",
    phone: "—",
    email: "bstoi10@bluedental.vn",
    role: "Bác Sĩ Điều Trị",
    address: "—",
    status: "working",
  },
  {
    id: "8",
    name: "BS Hương",
    phone: "—",
    email: "bshuong@bluedental.vn",
    role: "Bác Sĩ Điều Trị",
    address: "—",
    status: "working",
  },
  {
    id: "9",
    name: "BS Hương 4",
    phone: "—",
    email: "bshuong4@bluedental.vn",
    role: "Bác Sĩ Điều Trị",
    address: "—",
    status: "working",
  },
  {
    id: "10",
    name: "BS Tiên",
    phone: "—",
    email: "bstien@bluedental.vn",
    role: "Bác Sĩ Điều Trị",
    address: "—",
    status: "working",
  },
  {
    id: "11",
    name: "BS Khanh",
    phone: "—",
    email: "bskhanh@bluedental.vn",
    role: "Bác Sĩ Điều Trị",
    address: "—",
    status: "working",
  },
];

// ── Constants ──────────────────────────────────────────────────────────────

const STATUS_TABS: { key: StaffStatus; label: string }[] = [
  { key: "all", label: "Tất cả" },
  { key: "working", label: "Đang làm việc" },
  { key: "resigned", label: "Đã nghỉ" },
];

// ── Component ──────────────────────────────────────────────────────────────

export function StaffPage() {
  const [statusTab, setStatusTab] = useState<StaffStatus>("all");
  const [keyword, setKeyword] = useState("");

  const filtered = SYNTHETIC_STAFF.filter((s) => {
    const matchesStatus = statusTab === "all" || s.status === statusTab;
    const matchesKeyword =
      keyword.trim() === "" ||
      s.name.toLowerCase().includes(keyword.toLowerCase()) ||
      s.email.toLowerCase().includes(keyword.toLowerCase()) ||
      s.phone.includes(keyword);
    return matchesStatus && matchesKeyword;
  });

  const columns = [
    {
      title: "Tên",
      dataIndex: "name",
      key: "name",
      render: (name: string, record: StaffMember) => (
        <div>
          <div style={{ fontWeight: 500 }}>{name}</div>
          <div style={{ fontSize: 12, color: "#8c8c8c" }}>{record.role}</div>
        </div>
      ),
    },
    {
      title: "Số điện thoại",
      dataIndex: "phone",
      key: "phone",
    },
    {
      title: "Email",
      dataIndex: "email",
      key: "email",
    },
    {
      title: "Phân quyền",
      dataIndex: "role",
      key: "role",
      render: (role: string) => <Tag color="blue">{role}</Tag>,
    },
    {
      title: "Địa chỉ",
      dataIndex: "address",
      key: "address",
    },
    {
      title: "Thao tác",
      key: "actions",
      render: (_: unknown, _record: StaffMember) => (
        <div style={{ display: "flex", gap: 8 }}>
          <Button size="small">Chỉnh sửa</Button>
          <Button size="small" danger>
            Xoá
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="reception-page">
      {/* Toolbar */}
      <div className="reception-card reception-card--toolbar">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
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
                borderBottom:
                  statusTab === tab.key
                    ? "2px solid #1677ff"
                    : "2px solid transparent",
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
        <Table
          columns={columns}
          dataSource={filtered}
          rowKey="id"
          pagination={{
            pageSize: 20,
            showSizeChanger: true,
            pageSizeOptions: ["5", "10", "20", "25", "50", "100"],
            showTotal: (total, range) =>
              `Hiển thị ${range[0]}–${range[1]} trên ${total} nhân viên`,
          }}
          locale={{ emptyText: "Không có dữ liệu" }}
          size="middle"
        />
      </div>
    </div>
  );
}
