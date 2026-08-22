import { useState } from "react";
import { Button, Input, Table } from "antd";
import { SearchOutlined } from "@ant-design/icons";

// ── Types ──────────────────────────────────────────────────────────────────

type MaterialsSubRoute = "clinic" | "allocation" | "department";

// ── Constants ──────────────────────────────────────────────────────────────

const SUB_ROUTES: { key: MaterialsSubRoute; label: string }[] = [
  { key: "clinic", label: "Vật tư phòng khám" },
  { key: "allocation", label: "Phân bổ vật tư" },
  { key: "department", label: "Phòng ban" },
];

// ── Sub-views ──────────────────────────────────────────────────────────────

function ClinicMaterialsView() {
  const [keyword, setKeyword] = useState("");

  const columns = [
    {
      title: "",
      key: "checkbox",
      width: 40,
      render: () => <input type="checkbox" />,
    },
    { title: "Tên vật liệu", dataIndex: "name", key: "name" },
    { title: "Nhóm phân loại", dataIndex: "category", key: "category" },
    { title: "Nhập kho", dataIndex: "importDate", key: "importDate" },
    { title: "Hạn sử dụng", dataIndex: "expiryDate", key: "expiryDate" },
    { title: "Cảnh báo hết hạn", dataIndex: "expiryWarning", key: "expiryWarning" },
    { title: "Tồn kho", dataIndex: "stock", key: "stock" },
    { title: "Trạng thái", dataIndex: "status", key: "status" },
    { title: "Nhà cung cấp", dataIndex: "supplier", key: "supplier" },
    { title: "Xuất xứ", dataIndex: "origin", key: "origin" },
    { title: "Giá nhập", dataIndex: "purchasePrice", key: "purchasePrice" },
    { title: "Giá bán", dataIndex: "salePrice", key: "salePrice" },
    {
      title: "Thao tác",
      key: "actions",
      render: () => (
        <div style={{ display: "flex", gap: 8 }}>
          <Button size="small">Chỉnh sửa</Button>
          <Button size="small" danger>Xoá</Button>
        </div>
      ),
    },
  ];

  return (
    <div style={{ display: "flex", gap: 16 }}>
      {/* Left panel: material groups */}
      <div
        className="reception-card"
        style={{ width: 240, minWidth: 200, padding: 16, flexShrink: 0 }}
      >
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>
            Nhóm vật tư
            <span style={{ fontWeight: 400, color: "#8c8c8c", marginLeft: 6 }}>
              0 nhóm
            </span>
          </div>
          <div style={{ fontSize: 12, color: "#8c8c8c", marginBottom: 10 }}>
            Chọn nhóm để xem vật tư
          </div>
          <Input
            placeholder="Tìm nhóm vật tư..."
            size="small"
            style={{ marginBottom: 8 }}
          />
          <Button type="dashed" block size="small">
            Thêm Mới
          </Button>
        </div>
        <div
          style={{
            color: "#8c8c8c",
            fontSize: 13,
            textAlign: "center",
            paddingTop: 16,
          }}
        >
          Chưa có nhóm vật tư
        </div>
      </div>

      {/* Right panel */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 16 }}>
        <div className="reception-card reception-card--toolbar">
          <div
            style={{
              display: "flex",
              gap: 8,
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div style={{ display: "flex", gap: 8 }}>
              <Button type="primary">Thêm vật tư</Button>
              <Button disabled>Sync data hệ thống</Button>
            </div>
            <Input
              prefix={<SearchOutlined />}
              placeholder="Tìm kiếm..."
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              style={{ width: 220 }}
              allowClear
            />
          </div>
        </div>
        <div className="reception-card reception-card--content">
          <Table
            columns={columns}
            dataSource={[]}
            rowKey="id"
            scroll={{ x: "max-content" }}
            pagination={{
              pageSize: 20,
              showSizeChanger: true,
              pageSizeOptions: ["5", "10", "20", "25", "50", "100"],
              showTotal: (total) => `Hiển thị 0 trên ${total}`,
            }}
            locale={{ emptyText: "Không có dữ liệu" }}
            size="middle"
          />
        </div>
      </div>
    </div>
  );
}

function AllocationView() {
  const [keyword, setKeyword] = useState("");

  const columns = [
    { title: "Thời gian phân bổ", dataIndex: "allocationTime", key: "allocationTime" },
    { title: "Mã phân bổ", dataIndex: "allocationCode", key: "allocationCode" },
    { title: "Vật tư", dataIndex: "material", key: "material" },
    { title: "SL được phân bổ", dataIndex: "allocatedQty", key: "allocatedQty" },
    { title: "SL confirm còn lại", dataIndex: "confirmedRemaining", key: "confirmedRemaining" },
    { title: "Phòng ban", dataIndex: "department", key: "department" },
    { title: "Người thực hiện", dataIndex: "performer", key: "performer" },
    { title: "Ghi chú", dataIndex: "note", key: "note" },
    {
      title: "Thao tác",
      key: "actions",
      render: () => (
        <Button size="small" type="link">
          Chi tiết
        </Button>
      ),
    },
  ];

  return (
    <>
      <div className="reception-card reception-card--toolbar">
        <div style={{ display: "flex", gap: 8, justifyContent: "space-between" }}>
          <Input
            prefix={<SearchOutlined />}
            placeholder="Tìm phiếu phân bổ..."
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            style={{ width: 280 }}
            allowClear
          />
          <Button>Lịch sử kiểm kho</Button>
        </div>
      </div>
      <div className="reception-card reception-card--content">
        <Table
          columns={columns}
          dataSource={[]}
          rowKey="id"
          pagination={{
            pageSize: 20,
            showSizeChanger: true,
            pageSizeOptions: ["5", "10", "20", "25", "50", "100"],
            showTotal: (total) => `Hiển thị 0 trên ${total}`,
          }}
          locale={{ emptyText: "Chưa có phiếu phân bổ" }}
          size="middle"
        />
      </div>
    </>
  );
}

function DepartmentView() {
  const [keyword, setKeyword] = useState("");

  const rightColumns = [
    { title: "Thời gian phân bổ", dataIndex: "allocationTime", key: "allocationTime" },
    { title: "Mã phân bổ", dataIndex: "allocationCode", key: "allocationCode" },
    { title: "Vật tư", dataIndex: "material", key: "material" },
    { title: "SL được phát", dataIndex: "distributedQty", key: "distributedQty" },
    { title: "SL còn lại (đã duyệt)", dataIndex: "approvedRemaining", key: "approvedRemaining" },
    { title: "Kiểm kho", dataIndex: "inventoryCheck", key: "inventoryCheck" },
    { title: "Người thực hiện", dataIndex: "performer", key: "performer" },
    { title: "Ghi chú", dataIndex: "note", key: "note" },
    {
      title: "Thao tác",
      key: "actions",
      render: () => (
        <Button size="small" type="link">
          Chi tiết
        </Button>
      ),
    },
  ];

  return (
    <div style={{ display: "flex", gap: 16 }}>
      {/* Left panel: departments */}
      <div
        className="reception-card"
        style={{ width: 240, minWidth: 200, padding: 16, flexShrink: 0 }}
      >
        <div style={{ fontWeight: 600, marginBottom: 4 }}>
          Phòng ban
          <span style={{ fontWeight: 400, color: "#8c8c8c", marginLeft: 6 }}>
            0 phòng ban
          </span>
        </div>
        <div style={{ fontSize: 12, color: "#8c8c8c", marginBottom: 10 }}>
          Chọn phòng ban để xem vật tư đã phát và kiểm kho
        </div>
        <Input
          placeholder="Tìm phòng ban..."
          size="small"
          style={{ marginBottom: 8 }}
        />
        <Button type="dashed" block size="small">
          Tạo phòng ban
        </Button>
        <div
          style={{
            color: "#8c8c8c",
            fontSize: 13,
            textAlign: "center",
            paddingTop: 24,
          }}
        >
          Chưa có phòng ban
        </div>
      </div>

      {/* Right panel */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 16 }}>
        <div className="reception-card reception-card--toolbar">
          <div style={{ display: "flex", gap: 8, justifyContent: "space-between" }}>
            <Input
              prefix={<SearchOutlined />}
              placeholder="Tìm vật tư..."
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              style={{ width: 220 }}
              allowClear
            />
            <Button>Gộp số lượng vật tư</Button>
          </div>
        </div>
        <div className="reception-card reception-card--content">
          <Table
            columns={rightColumns}
            dataSource={[]}
            rowKey="id"
            pagination={{
              pageSize: 20,
              showSizeChanger: true,
              pageSizeOptions: ["5", "10", "20", "25", "50", "100"],
              showTotal: (total) => `Hiển thị 0 trên ${total}`,
            }}
            locale={{ emptyText: "Chọn phòng ban để xem vật tư đã phân bổ" }}
            size="middle"
          />
        </div>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export function MaterialsPage() {
  const [activeTab, setActiveTab] = useState<MaterialsSubRoute>("clinic");

  const renderContent = () => {
    switch (activeTab) {
      case "clinic":
        return <ClinicMaterialsView />;
      case "allocation":
        return <AllocationView />;
      case "department":
        return <DepartmentView />;
      default:
        return null;
    }
  };

  return (
    <div className="reception-page">
      {/* Horizontal sub-nav */}
      <div className="reception-card reception-card--tabs">
        <div style={{ display: "flex", gap: 0 }}>
          {SUB_ROUTES.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                padding: "8px 20px",
                border: "none",
                borderBottom:
                  activeTab === tab.key
                    ? "2px solid #1677ff"
                    : "2px solid transparent",
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

      {renderContent()}
    </div>
  );
}
