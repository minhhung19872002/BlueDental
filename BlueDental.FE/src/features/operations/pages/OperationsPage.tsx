import { useState } from "react";
import { Table, Empty, Tabs, Button, Input } from "antd";
import { SearchOutlined, PlusOutlined } from "@ant-design/icons";

const MAIN_TABS = [
  {
    key: "overview",
    label: "Quản trị vận hành",
    subTabs: [
      { key: "home",        label: "Trang chủ" },
      { key: "process",     label: "Quy trình" },
      { key: "task",        label: "Công việc" },
      { key: "report",      label: "Báo cáo" },
      { key: "untreated",   label: "Chẩn đoán chưa điều trị" },
      { key: "prescription",label: "Đơn thuốc" },
    ],
  },
  {
    key: "assistant",
    label: "Khối trợ lý",
    subTabs: [
      { key: "home",    label: "Trang chủ" },
      { key: "process", label: "Quy trình" },
      { key: "task",    label: "Công việc" },
    ],
  },
  {
    key: "reception",
    label: "Khối lễ tân",
    subTabs: [
      { key: "home",    label: "Trang chủ" },
      { key: "process", label: "Quy trình" },
      { key: "task",    label: "Công việc" },
      { key: "report",  label: "Báo cáo" },
    ],
  },
  {
    key: "cskh",
    label: "Khối CSKH",
    subTabs: [
      { key: "home",    label: "Trang chủ" },
      { key: "process", label: "Quy trình" },
      { key: "task",    label: "Công việc" },
      { key: "report",  label: "Báo cáo" },
    ],
  },
  {
    key: "marketing",
    label: "Khối Marketing",
    subTabs: [
      { key: "home",    label: "Trang chủ" },
      { key: "process", label: "Quy trình" },
      { key: "task",    label: "Công việc" },
      { key: "report",  label: "Báo cáo" },
    ],
  },
  {
    key: "security",
    label: "Khối bảo vệ",
    subTabs: [
      { key: "home",    label: "Trang chủ" },
      { key: "process", label: "Quy trình" },
      { key: "task",    label: "Công việc" },
      { key: "report",  label: "Báo cáo" },
    ],
  },
  {
    key: "treatment",
    label: "Khối điều trị",
    subTabs: [
      { key: "home",    label: "Trang chủ" },
      { key: "process", label: "Quy trình" },
      { key: "task",    label: "Công việc" },
      { key: "report",  label: "Báo cáo" },
    ],
  },
  {
    key: "finance",
    label: "Khối tài chính",
    subTabs: [
      { key: "home",    label: "Trang chủ" },
      { key: "process", label: "Quy trình" },
      { key: "task",    label: "Công việc" },
      { key: "report",  label: "Báo cáo" },
    ],
  },
];

const ARTICLE_COLUMNS = [
  { title: "Tiêu đề", dataIndex: "title", key: "title" },
  { title: "Ngày tạo", dataIndex: "createdAt", key: "createdAt", width: 130 },
  { title: "Ngày cập nhật", dataIndex: "updatedAt", key: "updatedAt", width: 150 },
  {
    title: "Thao tác",
    key: "actions",
    width: 120,
    render: () => (
      <div style={{ display: "flex", gap: 6 }}>
        <Button size="small">Sửa</Button>
        <Button size="small" danger>Xoá</Button>
      </div>
    ),
  },
];

export function OperationsPage() {
  const [activeTab, setActiveTab] = useState("overview");
  const [activeSubTabs, setActiveSubTabs] = useState<Record<string, string>>({});
  const [keyword, setKeyword] = useState("");

  const currentTabDef = MAIN_TABS.find((t) => t.key === activeTab)!;
  const activeSubTab = activeSubTabs[activeTab] ?? currentTabDef.subTabs[0]?.key ?? "";

  const setSubTab = (sub: string) => {
    setActiveSubTabs((prev) => ({ ...prev, [activeTab]: sub }));
  };

  return (
    <div className="reception-page">
      {/* Main department tabs */}
      <div className="reception-card" style={{ padding: "0 16px" }}>
        <Tabs
          activeKey={activeTab}
          onChange={(k) => setActiveTab(k)}
          style={{ marginBottom: 0 }}
          items={MAIN_TABS.map((t) => ({ key: t.key, label: t.label }))}
        />
      </div>

      {/* Sub-tabs */}
      {currentTabDef.subTabs.length > 0 && (
        <div className="reception-card reception-card--tabs">
          <div style={{ display: "flex", gap: 0 }}>
            {currentTabDef.subTabs.map((sub) => (
              <button
                key={sub.key}
                type="button"
                onClick={() => setSubTab(sub.key)}
                style={{
                  padding: "8px 16px",
                  border: "none",
                  borderBottom: activeSubTab === sub.key ? "2px solid #1677ff" : "2px solid transparent",
                  background: "none",
                  color: activeSubTab === sub.key ? "#1677ff" : "#595959",
                  fontWeight: activeSubTab === sub.key ? 600 : 400,
                  cursor: "pointer",
                  fontSize: 13,
                  whiteSpace: "nowrap",
                }}
              >
                {sub.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Content: two-panel (sidebar list + main table) */}
      <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
        {/* Left sidebar */}
        <div className="reception-card" style={{ width: 220, minWidth: 180, flexShrink: 0, padding: 12 }}>
          <Button type="dashed" block icon={<PlusOutlined />} style={{ marginBottom: 10 }}>Thêm Mới</Button>
          <div style={{ color: "#9CA3AF", fontSize: 13, textAlign: "center", paddingTop: 20 }}>
            Chưa có mục nào
          </div>
        </div>

        {/* Right content */}
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 0 }}>
          <div className="reception-card reception-card--toolbar">
            <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "space-between" }}>
              <Button type="primary" disabled style={{ background: "#2671D8" }}>Tạo Bài Viết</Button>
              <Input
                prefix={<SearchOutlined style={{ color: "#9CA3AF" }} />}
                placeholder="Tìm kiếm..."
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                allowClear
                style={{ maxWidth: 240 }}
              />
            </div>
          </div>
          <div className="reception-card reception-card--content">
            <Table
              rowKey="id"
              size="small"
              dataSource={[]}
              columns={ARTICLE_COLUMNS}
              locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Không có dữ liệu" /> }}
              pagination={{ pageSize: 20, showTotal: (total) => `${total} bài viết` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
