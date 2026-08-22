import { useState } from "react";
import { Table, Button, Input, Tag } from "antd";
import { SearchOutlined } from "@ant-design/icons";

// ── Types ──────────────────────────────────────────────────────────────────

type ToolCategory = "call" | "message" | "zalo-oa" | "invoice";

// ── Constants ──────────────────────────────────────────────────────────────

const TOOL_TABS: { key: ToolCategory; label: string }[] = [
  { key: "call",     label: "Gọi thoại" },
  { key: "message",  label: "Tin nhắn" },
  { key: "zalo-oa",  label: "Zalo OA" },
  { key: "invoice",  label: "Hóa đơn" },
];

const CALL_SUB_TABS = [
  { key: "config",    label: "Cấu Hình" },
  { key: "assign",    label: "Phân Công Gọi" },
  { key: "list",      label: "Danh Sách Cuộc Gọi" },
];

const MESSAGE_SUB_TABS = [
  { key: "config",    label: "Cấu Hình" },
  { key: "templates", label: "Mẫu Tin Nhắn" },
  { key: "list",      label: "Danh Sách Tin Nhắn" },
];

const ZALO_SUB_TABS = [
  { key: "config",    label: "Cấu Hình" },
  { key: "templates", label: "Mẫu ZBS" },
  { key: "list",      label: "Danh sách Tin Nhắn" },
];

// ── Helpers ────────────────────────────────────────────────────────────────

function SubTabBar({
  tabs,
  active,
  onChange,
}: {
  tabs: { key: string; label: string }[];
  active: string;
  onChange: (k: string) => void;
}) {
  return (
    <div className="reception-card reception-card--tabs">
      <div style={{ display: "flex", gap: 0 }}>
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => onChange(tab.key)}
            style={{
              padding: "8px 16px",
              border: "none",
              borderBottom: active === tab.key ? "2px solid #1677ff" : "2px solid transparent",
              background: "none",
              color: active === tab.key ? "#1677ff" : "#595959",
              fontWeight: active === tab.key ? 600 : 400,
              cursor: "pointer",
              fontSize: 13,
              whiteSpace: "nowrap",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function PlaceholderContent({ label }: { label: string }) {
  return (
    <div className="reception-card reception-card--content">
      <div style={{ padding: "48px 0", textAlign: "center", color: "#9CA3AF" }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>🛠️</div>
        <div style={{ fontWeight: 500, color: "#6B7280" }}>{label}</div>
        <div style={{ fontSize: 13, marginTop: 4 }}>Nội dung đang được phát triển</div>
      </div>
    </div>
  );
}

// ── "Gọi thoại" views ─────────────────────────────────────────────────────

function CallConfigView() {
  const [keyword, setKeyword] = useState("");

  const columns = [
    { title: "Tên", dataIndex: "name", key: "name" },
    { title: "Chi nhánh", dataIndex: "branch", key: "branch" },
    { title: "Loại cài đặt", dataIndex: "settingType", key: "settingType" },
    { title: "Nhà cung cấp", dataIndex: "provider", key: "provider" },
    {
      title: "Trạng thái",
      dataIndex: "status",
      key: "status",
      render: (v: string | undefined) =>
        v ? <Tag color={v === "Đã kích hoạt" ? "green" : "default"}>{v}</Tag> : null,
    },
    {
      title: "Thao tác",
      key: "actions",
      render: () => (
        <div style={{ display: "flex", gap: 6 }}>
          <Button size="small">Chỉnh sửa</Button>
          <Button size="small" danger>Xoá</Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <div className="reception-card reception-card--toolbar">
        <div style={{ display: "flex", gap: 8, justifyContent: "space-between" }}>
          <Input
            prefix={<SearchOutlined />}
            placeholder="Tìm kiếm..."
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            style={{ width: 260 }}
            allowClear
          />
          <Button type="primary">Tạo cấu hình</Button>
        </div>
      </div>
      <div className="reception-card reception-card--content">
        <Table
          columns={columns}
          dataSource={[]}
          rowKey="id"
          size="small"
          locale={{ emptyText: "Chưa có cấu hình nào" }}
          pagination={{ pageSize: 20, showTotal: (total) => `Hiển thị 0 trên ${total}` }}
        />
      </div>
    </>
  );
}

function CallView() {
  const [sub, setSub] = useState("config");

  return (
    <>
      <SubTabBar tabs={CALL_SUB_TABS} active={sub} onChange={setSub} />
      {sub === "config" && <CallConfigView />}
      {sub === "assign" && <PlaceholderContent label="Phân Công Gọi" />}
      {sub === "list" && <PlaceholderContent label="Danh Sách Cuộc Gọi" />}
    </>
  );
}

// ── "Tin nhắn" views ──────────────────────────────────────────────────────

function MessageConfigView() {
  const [keyword, setKeyword] = useState("");

  const columns = [
    { title: "Tên", dataIndex: "name", key: "name" },
    { title: "Nhà cung cấp", dataIndex: "provider", key: "provider" },
    {
      title: "Trạng thái",
      dataIndex: "status",
      key: "status",
      render: (v: string | undefined) =>
        v ? <Tag color={v === "Đã kích hoạt" ? "green" : "default"}>{v}</Tag> : null,
    },
    {
      title: "Thao tác",
      key: "actions",
      render: () => (
        <div style={{ display: "flex", gap: 6 }}>
          <Button size="small">Chỉnh sửa</Button>
          <Button size="small" danger>Xoá</Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <div className="reception-card reception-card--toolbar">
        <div style={{ display: "flex", gap: 8, justifyContent: "space-between" }}>
          <Input
            prefix={<SearchOutlined />}
            placeholder="Tìm kiếm..."
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            style={{ width: 260 }}
            allowClear
          />
          <Button type="primary">Tạo cấu hình</Button>
        </div>
      </div>
      <div className="reception-card reception-card--content">
        <Table
          columns={columns}
          dataSource={[]}
          rowKey="id"
          size="small"
          locale={{ emptyText: "Chưa có cấu hình nào" }}
          pagination={{ pageSize: 20, showTotal: (total) => `Hiển thị 0 trên ${total}` }}
        />
      </div>
    </>
  );
}

function MessageView() {
  const [sub, setSub] = useState("config");

  return (
    <>
      <SubTabBar tabs={MESSAGE_SUB_TABS} active={sub} onChange={setSub} />
      {sub === "config" && <MessageConfigView />}
      {sub === "templates" && <PlaceholderContent label="Mẫu Tin Nhắn" />}
      {sub === "list" && <PlaceholderContent label="Danh Sách Tin Nhắn" />}
    </>
  );
}

// ── "Zalo OA" views ───────────────────────────────────────────────────────

function ZaloConfigView() {
  return (
    <div className="reception-card reception-card--content">
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "48px 0", gap: 16 }}>
        <div style={{
          width: 80, height: 80, borderRadius: "50%",
          background: "#F3F4F6",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 32,
        }}>
          OA
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontWeight: 600, fontSize: 16, color: "#1B2A41", marginBottom: 6 }}>
            Chưa kết nối Zalo OA
          </div>
          <Tag color="default" style={{ marginBottom: 16 }}>Chưa kích hoạt</Tag>
          <div>
            <Button type="primary" disabled>Kết nối Zalo OA</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ZaloView() {
  const [sub, setSub] = useState("config");

  return (
    <>
      <SubTabBar tabs={ZALO_SUB_TABS} active={sub} onChange={setSub} />
      {sub === "config" && <ZaloConfigView />}
      {sub === "templates" && <PlaceholderContent label="Mẫu ZBS" />}
      {sub === "list" && <PlaceholderContent label="Danh sách Tin Nhắn" />}
    </>
  );
}

// ── "Hóa đơn" view ────────────────────────────────────────────────────────

interface InvoiceConfig {
  id: string;
  name: string;
  branch: string;
  module: string;
  provider: string;
  status: string;
}

const INVOICE_DATA: InvoiceConfig[] = [
  { id: "1", name: "Quang Vinh", branch: "Chi nhánh Quang Vinh", module: "Hóa đơn", provider: "MISA", status: "Đã kích hoạt" },
  { id: "2", name: "Thuế Hố Nai", branch: "Chi nhánh Hố Nai", module: "Hóa đơn", provider: "MISA", status: "Đã kích hoạt" },
];

function InvoiceView() {
  const [keyword, setKeyword] = useState("");

  const filtered = INVOICE_DATA.filter(
    (r) => r.name.toLowerCase().includes(keyword.toLowerCase()) || r.branch.toLowerCase().includes(keyword.toLowerCase()),
  );

  const columns = [
    { title: "Tên", dataIndex: "name", key: "name" },
    { title: "Tên chi nhánh", dataIndex: "branch", key: "branch" },
    { title: "Mô đun", dataIndex: "module", key: "module" },
    { title: "Nhà cung cấp", dataIndex: "provider", key: "provider" },
    {
      title: "Trạng thái",
      dataIndex: "status",
      key: "status",
      render: (v: string) => <Tag color="green">{v}</Tag>,
    },
    {
      title: "Thao tác",
      key: "actions",
      render: () => (
        <div style={{ display: "flex", gap: 6 }}>
          <Button size="small">Chỉnh sửa</Button>
          <Button size="small" danger>Xoá</Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <div className="reception-card reception-card--tabs">
        <button
          type="button"
          style={{
            padding: "8px 16px",
            border: "none",
            borderBottom: "2px solid #1677ff",
            background: "none",
            color: "#1677ff",
            fontWeight: 600,
            cursor: "default",
            fontSize: 13,
          }}
        >
          Cấu Hình
        </button>
      </div>
      <div className="reception-card reception-card--toolbar">
        <div style={{ display: "flex", gap: 8, justifyContent: "space-between" }}>
          <Input
            prefix={<SearchOutlined />}
            placeholder="Tìm kiếm..."
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            style={{ width: 260 }}
            allowClear
          />
          <Button type="primary">Tạo cấu hình</Button>
        </div>
      </div>
      <div className="reception-card reception-card--content">
        <Table
          columns={columns}
          dataSource={filtered}
          rowKey="id"
          size="small"
          locale={{ emptyText: "Chưa có cấu hình nào" }}
          pagination={{ pageSize: 20, showTotal: (total) => `Hiển thị 0 trên ${total}` }}
        />
      </div>
    </>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export function ToolsPage() {
  const [activeTab, setActiveTab] = useState<ToolCategory>("call");

  return (
    <div className="reception-page">
      {/* Top tool category tabs */}
      <div className="reception-card reception-card--toolbar">
        <div style={{ display: "flex", gap: 0 }}>
          {TOOL_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              style={{
                padding: "8px 20px",
                border: "none",
                borderBottom: activeTab === tab.key ? "2px solid #1677ff" : "2px solid transparent",
                background: "none",
                color: activeTab === tab.key ? "#1677ff" : "#595959",
                fontWeight: activeTab === tab.key ? 600 : 400,
                cursor: "pointer",
                fontSize: 14,
                whiteSpace: "nowrap",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === "call"     && <CallView />}
      {activeTab === "message"  && <MessageView />}
      {activeTab === "zalo-oa"  && <ZaloView />}
      {activeTab === "invoice"  && <InvoiceView />}
    </div>
  );
}
