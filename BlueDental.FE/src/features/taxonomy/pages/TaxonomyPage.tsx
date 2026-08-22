// TaxonomyPage — /taxonomy
// Catalog management page with 11 sub-routes implemented as tabs.
// Default tab (service) shows two-panel layout: group sidebar + service table.
// All other tabs show a simple empty table.

import { useState } from "react";
import { Table, Empty, Tabs } from "antd";
import type { ColumnsType } from "antd/es/table";

interface TaxonomyRecord {
  id: string;
  name: string;
  group?: string;
  price?: string;
  updatedAt?: string;
}

interface TaxonomyTab {
  key: string;
  label: string;
}

const TAXONOMY_TABS: TaxonomyTab[] = [
  { key: "service", label: "Dịch vụ" },
  { key: "diagnosis", label: "Chẩn đoán" },
  { key: "medicine", label: "Loại thuốc" },
  { key: "consulting", label: "Dữ liệu tư vấn" },
  { key: "source", label: "Nguồn đến" },
  { key: "history", label: "Lịch sử bệnh" },
  { key: "prescription-template", label: "Đơn thuốc mẫu" },
  { key: "medical-record-template", label: "Bệnh án mẫu" },
  { key: "tags", label: "Thẻ hồ sơ" },
  { key: "payment-method", label: "Phương thức thanh toán" },
  { key: "occupation", label: "Nghề nghiệp" },
];

const SERVICE_COLUMNS: ColumnsType<TaxonomyRecord> = [
  {
    title: "",
    key: "drag",
    width: 32,
    render: () => (
      <span style={{ color: "#CBD5E1", cursor: "grab" }}>⠿</span>
    ),
  },
  { title: "Tên dịch vụ", dataIndex: "name", key: "name" },
  { title: "Nhóm phân loại", dataIndex: "group", key: "group" },
  { title: "Giá", dataIndex: "price", key: "price" },
  { title: "Cập nhật gần nhất", dataIndex: "updatedAt", key: "updatedAt" },
  {
    title: "Thao tác",
    key: "actions",
    width: 100,
    render: () => null,
  },
];

function buildSimpleColumns(nameLabel: string): ColumnsType<TaxonomyRecord> {
  return [
    {
      title: "",
      key: "drag",
      width: 32,
      render: () => (
        <span style={{ color: "#CBD5E1", cursor: "grab" }}>⠿</span>
      ),
    },
    { title: nameLabel, dataIndex: "name", key: "name" },
    { title: "Nhóm phân loại", dataIndex: "group", key: "group" },
    { title: "Cập nhật gần nhất", dataIndex: "updatedAt", key: "updatedAt" },
    {
      title: "Thao tác",
      key: "actions",
      width: 100,
      render: () => null,
    },
  ];
}

function GroupSidebar() {
  return (
    <div
      style={{
        width: 230,
        flexShrink: 0,
        border: "1px solid #DCE3EE",
        borderRadius: 10,
        padding: 14,
        background: "#fff",
      }}
    >
      <div
        style={{
          fontWeight: 700,
          fontSize: 14,
          marginBottom: 4,
          color: "#1B2A41",
        }}
      >
        Nhóm dịch vụ
      </div>
      <div style={{ fontSize: 12, color: "#5A6B82", marginBottom: 14 }}>
        Chọn nhóm để xem dịch vụ bên trong
      </div>
      <div
        style={{
          textAlign: "center",
          padding: "32px 0",
          color: "#8FA4BD",
          fontSize: 13,
        }}
      >
        Chưa có nhóm dịch vụ
      </div>
    </div>
  );
}

function ServicePanel() {
  return (
    <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
      <GroupSidebar />
      <div style={{ flex: 1, minWidth: 0 }}>
        <Table<TaxonomyRecord>
          rowKey="id"
          dataSource={[]}
          columns={SERVICE_COLUMNS}
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="Không có dữ liệu"
              />
            ),
          }}
          pagination={false}
        />
      </div>
    </div>
  );
}

function SimpleTabPanel({ activeTab }: { activeTab: string }) {
  const tab = TAXONOMY_TABS.find((t) => t.key === activeTab);
  const nameLabel = tab?.label ?? "Tên";
  const columns = buildSimpleColumns(nameLabel);

  return (
    <Table<TaxonomyRecord>
      rowKey="id"
      dataSource={[]}
      columns={columns}
      locale={{
        emptyText: (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="Không có dữ liệu"
          />
        ),
      }}
      pagination={false}
    />
  );
}

export function TaxonomyPage() {
  const [activeTab, setActiveTab] = useState("service");

  return (
    <div className="reception-page">
      <div className="reception-card reception-card--toolbar">
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          style={{ marginBottom: 0 }}
          items={TAXONOMY_TABS.map((tab) => ({
            key: tab.key,
            label: tab.label,
          }))}
        />
      </div>
      <div className="reception-card reception-card--content">
        {activeTab === "service" ? (
          <ServicePanel />
        ) : (
          <SimpleTabPanel activeTab={activeTab} />
        )}
      </div>
    </div>
  );
}
