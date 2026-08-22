// OperationsPage — /operations
// Internal operations management with department tabs.
// Each tab shows an article-list table (title, created, updated, actions).

import { useState } from "react";
import { Table, Empty, Tabs } from "antd";

interface OperationsTab {
  key: string;
  label: string;
}

const OPERATIONS_TABS: OperationsTab[] = [
  { key: "overview", label: "Tổng quan" },
  { key: "general-dentistry", label: "Nha khoa tổng quát" },
  { key: "aesthetic-dentistry", label: "Nha khoa thẩm mỹ" },
  { key: "orthodontics", label: "Chỉnh nha" },
  { key: "implant", label: "Cấy ghép Implant" },
  { key: "finance", label: "Tài chính" },
  { key: "treatment", label: "Điều trị" },
  { key: "activity-report", label: "Báo cáo hoạt động" },
];

const ARTICLE_COLUMNS = [
  { title: "Tiêu đề", dataIndex: "title", key: "title" },
  { title: "Ngày tạo", dataIndex: "createdAt", key: "createdAt" },
  { title: "Ngày cập nhật", dataIndex: "updatedAt", key: "updatedAt" },
  { title: "Thao tác", dataIndex: "actions", key: "actions", width: 120 },
];

export function OperationsPage() {
  const [activeTab, setActiveTab] = useState("overview");

  const activeLabel =
    OPERATIONS_TABS.find((t) => t.key === activeTab)?.label ?? "";

  return (
    <div className="reception-page">
      <div className="reception-card reception-card--toolbar">
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          style={{ marginBottom: 0 }}
          items={OPERATIONS_TABS.map((tab) => ({
            key: tab.key,
            label: tab.label,
          }))}
        />
      </div>
      <div className="reception-card reception-card--content">
        <h2
          style={{
            fontSize: 18,
            fontWeight: 600,
            marginBottom: 16,
            color: "#1B2A41",
          }}
        >
          {activeLabel}
        </h2>
        <Table
          rowKey="id"
          dataSource={[]}
          columns={ARTICLE_COLUMNS}
          locale={{
            emptyText: (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Không có dữ liệu" />
            ),
          }}
          pagination={false}
        />
      </div>
    </div>
  );
}
