import { useState } from "react";
import { Table, Button, Input, Tag } from "antd";
import { SearchOutlined } from "@ant-design/icons";
import { t } from "@/lib/i18n";
import { PageHeader } from "@/components/PageHeader";

// ── Types ──────────────────────────────────────────────────────────────────

type ToolCategory = "call" | "message" | "zalo-oa" | "invoice";

// ── Constants ──────────────────────────────────────────────────────────────

const toolTabs = (): { key: ToolCategory; label: string }[] => [
  { key: "call",     label: t("Gọi thoại") },
  { key: "message",  label: t("Tin nhắn") },
  { key: "zalo-oa",  label: "Zalo OA" },
  { key: "invoice",  label: t("Hóa đơn") },
];

const callSubTabs = () => [
  { key: "config",    label: t("Cấu Hình") },
  { key: "assign",    label: t("Phân Công Gọi") },
  { key: "list",      label: t("Danh Sách Cuộc Gọi") },
];

const messageSubTabs = () => [
  { key: "config",    label: t("Cấu Hình") },
  { key: "templates", label: t("Mẫu Tin Nhắn") },
  { key: "list",      label: t("Danh Sách Tin Nhắn") },
];

const zaloSubTabs = () => [
  { key: "config",    label: t("Cấu Hình") },
  { key: "templates", label: t("Mẫu ZBS") },
  { key: "list",      label: t("Danh sách Tin Nhắn") },
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
      <PageHeader
        title={t("Công cụ")}
        subtitle={t("Tổng đài, tin nhắn, Zalo OA và hoá đơn điện tử")}
      />

      <div style={{ display: "flex", gap: 0 }}>
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => onChange(tab.key)}
            style={{
              padding: "8px 16px",
              border: "none",
              borderBottom: active === tab.key ? "2px solid #1c3566" : "2px solid transparent",
              background: "none",
              color: active === tab.key ? "#1c3566" : "#6f7c90",
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
      <div style={{ padding: "48px 0", textAlign: "center", color: "#98a4b4" }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>🛠️</div>
        <div style={{ fontWeight: 500, color: "#6f7c90" }}>{label}</div>
        <div style={{ fontSize: 13, marginTop: 4 }}>{t("Nội dung đang được phát triển")}</div>
      </div>
    </div>
  );
}

// ── "Gọi thoại" views ─────────────────────────────────────────────────────

function CallConfigView() {
  const [keyword, setKeyword] = useState("");

  const columns = [
    { title: t("Tên"), dataIndex: "name", key: "name" },
    { title: t("Chi nhánh"), dataIndex: "branch", key: "branch" },
    { title: t("Loại cài đặt"), dataIndex: "settingType", key: "settingType" },
    { title: t("Nhà cung cấp"), dataIndex: "provider", key: "provider" },
    {
      title: t("Trạng thái"),
      dataIndex: "status",
      key: "status",
      render: (v: string | undefined) =>
        v ? <Tag color={v === "Đã kích hoạt" ? "green" : "default"}>{v}</Tag> : null,
    },
    {
      title: t("Thao tác"),
      key: "actions",
      render: () => (
        <div style={{ display: "flex", gap: 6 }}>
          <Button size="small">{t("Chỉnh sửa")}</Button>
          <Button size="small" danger>{t("Xoá")}</Button>
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
            placeholder={t("Tìm kiếm...")}
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            style={{ width: 260 }}
            allowClear
          />
          <Button type="primary">{t("Tạo cấu hình")}</Button>
        </div>
      </div>
      <div className="reception-card reception-card--content">
        <Table
          columns={columns}
          dataSource={[]}
          rowKey="id"
          size="small"
          locale={{ emptyText: t("Chưa có cấu hình nào") }}
          pagination={{ pageSize: 20, showTotal: (total) => t("Hiển thị 0 trên {0}", total) }}
        />
      </div>
    </>
  );
}

function CallView() {
  const [sub, setSub] = useState("config");

  return (
    <>
      <SubTabBar tabs={callSubTabs()} active={sub} onChange={setSub} />
      {sub === "config" && <CallConfigView />}
      {sub === "assign" && <PlaceholderContent label={t("Phân Công Gọi")} />}
      {sub === "list" && <PlaceholderContent label={t("Danh Sách Cuộc Gọi")} />}
    </>
  );
}

// ── "Tin nhắn" views ──────────────────────────────────────────────────────

function MessageConfigView() {
  const [keyword, setKeyword] = useState("");

  const columns = [
    { title: t("Tên"), dataIndex: "name", key: "name" },
    { title: t("Nhà cung cấp"), dataIndex: "provider", key: "provider" },
    {
      title: t("Trạng thái"),
      dataIndex: "status",
      key: "status",
      render: (v: string | undefined) =>
        v ? <Tag color={v === "Đã kích hoạt" ? "green" : "default"}>{v}</Tag> : null,
    },
    {
      title: t("Thao tác"),
      key: "actions",
      render: () => (
        <div style={{ display: "flex", gap: 6 }}>
          <Button size="small">{t("Chỉnh sửa")}</Button>
          <Button size="small" danger>{t("Xoá")}</Button>
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
            placeholder={t("Tìm kiếm...")}
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            style={{ width: 260 }}
            allowClear
          />
          <Button type="primary">{t("Tạo cấu hình")}</Button>
        </div>
      </div>
      <div className="reception-card reception-card--content">
        <Table
          columns={columns}
          dataSource={[]}
          rowKey="id"
          size="small"
          locale={{ emptyText: t("Chưa có cấu hình nào") }}
          pagination={{ pageSize: 20, showTotal: (total) => t("Hiển thị 0 trên {0}", total) }}
        />
      </div>
    </>
  );
}

function MessageView() {
  const [sub, setSub] = useState("config");

  return (
    <>
      <SubTabBar tabs={messageSubTabs()} active={sub} onChange={setSub} />
      {sub === "config" && <MessageConfigView />}
      {sub === "templates" && <PlaceholderContent label={t("Mẫu Tin Nhắn")} />}
      {sub === "list" && <PlaceholderContent label={t("Danh Sách Tin Nhắn")} />}
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
          background: "#f4f6fa",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 32,
        }}>
          OA
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontWeight: 600, fontSize: 16, color: "#101c2c", marginBottom: 6 }}>
            {t("Chưa kết nối Zalo OA")}
          </div>
          <Tag color="default" style={{ marginBottom: 16 }}>{t("Chưa kích hoạt")}</Tag>
          <div>
            <Button type="primary" disabled>{t("Kết nối Zalo OA")}</Button>
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
      <SubTabBar tabs={zaloSubTabs()} active={sub} onChange={setSub} />
      {sub === "config" && <ZaloConfigView />}
      {sub === "templates" && <PlaceholderContent label={t("Mẫu ZBS")} />}
      {sub === "list" && <PlaceholderContent label={t("Danh sách Tin Nhắn")} />}
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
    { title: t("Tên"), dataIndex: "name", key: "name" },
    { title: t("Tên chi nhánh"), dataIndex: "branch", key: "branch" },
    { title: t("Mô đun"), dataIndex: "module", key: "module" },
    { title: t("Nhà cung cấp"), dataIndex: "provider", key: "provider" },
    {
      title: t("Trạng thái"),
      dataIndex: "status",
      key: "status",
      render: (v: string) => <Tag color="green">{v}</Tag>,
    },
    {
      title: t("Thao tác"),
      key: "actions",
      render: () => (
        <div style={{ display: "flex", gap: 6 }}>
          <Button size="small">{t("Chỉnh sửa")}</Button>
          <Button size="small" danger>{t("Xoá")}</Button>
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
            borderBottom: "2px solid #1c3566",
            background: "none",
            color: "#1c3566",
            fontWeight: 600,
            cursor: "default",
            fontSize: 13,
          }}
        >
          {t("Cấu Hình")}
        </button>
      </div>
      <div className="reception-card reception-card--toolbar">
        <div style={{ display: "flex", gap: 8, justifyContent: "space-between" }}>
          <Input
            prefix={<SearchOutlined />}
            placeholder={t("Tìm kiếm...")}
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            style={{ width: 260 }}
            allowClear
          />
          <Button type="primary">{t("Tạo cấu hình")}</Button>
        </div>
      </div>
      <div className="reception-card reception-card--content">
        <Table
          columns={columns}
          dataSource={filtered}
          rowKey="id"
          size="small"
          locale={{ emptyText: t("Chưa có cấu hình nào") }}
          pagination={{ pageSize: 20, showTotal: (total) => t("Hiển thị 0 trên {0}", total) }}
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
          {toolTabs().map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              style={{
                padding: "8px 20px",
                border: "none",
                borderBottom: activeTab === tab.key ? "2px solid #1c3566" : "2px solid transparent",
                background: "none",
                color: activeTab === tab.key ? "#1c3566" : "#6f7c90",
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
