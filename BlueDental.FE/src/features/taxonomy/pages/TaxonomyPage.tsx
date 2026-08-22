import { useState } from "react";
import { Table, Empty, Tabs, Input, Button } from "antd";
import { SearchOutlined } from "@ant-design/icons";
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

interface ServiceGroup {
  key: string;
  label: string;
  count: number;
}

const SERVICE_GROUPS: ServiceGroup[] = [
  { key: "phau-thuat", label: "PHẪU THUẬT NHA CHU", count: 0 },
  { key: "tong-quat",  label: "NHA KHOA TỔNG QUÁT",  count: 0 },
  { key: "tham-my",    label: "NHA KHOA THẨM MỸ",    count: 0 },
  { key: "chinh-nha",  label: "CHỈNH NHA",            count: 0 },
  { key: "implant",    label: "CẤY GHÉP IMPLANT",     count: 0 },
];

function GroupSidebar({
  selectedGroup,
  onSelect,
}: {
  selectedGroup: string;
  onSelect: (key: string) => void;
}) {
  const [groupSearch, setGroupSearch] = useState("");
  const filtered = SERVICE_GROUPS.filter((g) =>
    g.label.toLowerCase().includes(groupSearch.toLowerCase()),
  );

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
      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 2, color: "#1B2A41" }}>
        Nhóm dịch vụ
        <span style={{ fontWeight: 400, color: "#8FA4BD", marginLeft: 6, fontSize: 13 }}>
          {SERVICE_GROUPS.length} nhóm
        </span>
      </div>
      <div style={{ fontSize: 12, color: "#5A6B82", marginBottom: 10 }}>
        Chọn nhóm để xem dịch vụ bên trong
      </div>
      <Input
        prefix={<SearchOutlined />}
        placeholder="Tìm nhóm..."
        size="small"
        value={groupSearch}
        onChange={(e) => setGroupSearch(e.target.value)}
        style={{ marginBottom: 8 }}
        allowClear
      />
      <Button type="dashed" block size="small" style={{ marginBottom: 10 }}>
        Thêm nhóm mới
      </Button>
      {filtered.map((group) => (
        <button
          key={group.key}
          type="button"
          onClick={() => onSelect(group.key)}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
            padding: "8px 10px",
            borderRadius: 6,
            border: "none",
            background: selectedGroup === group.key ? "#EBF3FE" : "none",
            color: selectedGroup === group.key ? "#1E5BB0" : "#374151",
            fontWeight: selectedGroup === group.key ? 600 : 400,
            fontSize: 13,
            cursor: "pointer",
            textAlign: "left",
            marginBottom: 2,
          }}
        >
          <span>{group.label}</span>
          <span style={{ fontSize: 12, color: "#9CA3AF" }}>{group.count}</span>
        </button>
      ))}
    </div>
  );
}

function ServicePanel() {
  const [selectedGroup, setSelectedGroup] = useState("phau-thuat");
  const [serviceKeyword, setServiceKeyword] = useState("");
  const currentGroup = SERVICE_GROUPS.find((g) => g.key === selectedGroup);

  return (
    <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
      <GroupSidebar selectedGroup={selectedGroup} onSelect={setSelectedGroup} />
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Right panel toolbar */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: "#1B2A41" }}>
            {currentGroup?.label ?? "Dịch vụ"}
            <span style={{ fontWeight: 400, color: "#9CA3AF", fontSize: 13, marginLeft: 8 }}>
              {currentGroup?.count ?? 0} bản ghi
            </span>
          </div>
          <div style={{ fontSize: 12, color: "#5A6B82", marginBottom: 10 }}>
            Quản lý các mục thuộc nhóm {currentGroup?.label}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "space-between" }}>
            <div style={{ display: "flex", gap: 8 }}>
              <Button>Xuất</Button>
              <Button type="primary">Thêm dịch vụ</Button>
            </div>
            <Input
              prefix={<SearchOutlined />}
              placeholder="Tìm theo tên dịch vụ..."
              value={serviceKeyword}
              onChange={(e) => setServiceKeyword(e.target.value)}
              style={{ width: 240 }}
              allowClear
            />
          </div>
        </div>
        <Table<TaxonomyRecord>
          rowKey="id"
          dataSource={[]}
          columns={SERVICE_COLUMNS}
          size="middle"
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="Không có dữ liệu"
              />
            ),
          }}
          pagination={{
            pageSize: 20,
            showTotal: (total) => `Hiển thị 0 trên ${total} bản ghi`,
          }}
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
