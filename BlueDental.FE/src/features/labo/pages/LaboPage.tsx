import { useState } from "react";
import { Button, Input, Select, Table } from "antd";
import { SearchOutlined, DownloadOutlined } from "@ant-design/icons";

// ── Types ──────────────────────────────────────────────────────────────────

type LaboSubRoute =
  | "mau-labo"
  | "supplier"
  | "bite"
  | "finish-line"
  | "nhip"
  | "service-material";

// ── Constants ──────────────────────────────────────────────────────────────

const SUB_ROUTES: { key: LaboSubRoute; label: string }[] = [
  { key: "mau-labo", label: "Mẫu Labo" },
  { key: "supplier", label: "Nhà cung cấp Labo" },
  { key: "bite", label: "Khớp cắn Labo" },
  { key: "finish-line", label: "Đường hoàn tất" },
  { key: "nhip", label: "Kiểu nhịp Labo" },
  { key: "service-material", label: "Dịch vụ - vật liệu" },
];

const MAU_LABO_FILTER_TABS = [
  { key: "all", label: "Tất Cả Mẫu" },
  { key: "unreceived", label: "Mẫu Chưa Nhận" },
  { key: "late", label: "Mẫu Giao Trễ" },
  { key: "received", label: "Mẫu Đã Nhận Hàng" },
];

// ── Sub-views ──────────────────────────────────────────────────────────────

function MauLaboView() {
  const [filterTab, setFilterTab] = useState("all");
  const [keyword, setKeyword] = useState("");

  const columns = [
    { title: "Nhà cung cấp / Ngày tạo", dataIndex: "supplier", key: "supplier" },
    { title: "Tên khách hàng", dataIndex: "patientName", key: "patientName" },
    { title: "Ngày gửi / Tình trạng mẫu", dataIndex: "sendDate", key: "sendDate" },
    { title: "Ngày giao / Trạng thái Labo", dataIndex: "deliveryDate", key: "deliveryDate" },
    { title: "Bác sĩ chỉ định", dataIndex: "doctor", key: "doctor" },
    { title: "Vật liệu", dataIndex: "material", key: "material" },
    { title: "Răng", dataIndex: "teeth", key: "teeth" },
    { title: "File phòng khám gửi về", dataIndex: "file", key: "file" },
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
      {/* Status filter tabs */}
      <div className="reception-card reception-card--tabs">
        <div style={{ display: "flex", gap: 0, flexWrap: "wrap" }}>
          {MAU_LABO_FILTER_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilterTab(tab.key)}
              style={{
                padding: "8px 16px",
                border: "none",
                borderBottom:
                  filterTab === tab.key
                    ? "2px solid #1677ff"
                    : "2px solid transparent",
                background: "none",
                color: filterTab === tab.key ? "#1677ff" : "#595959",
                fontWeight: filterTab === tab.key ? 600 : 400,
                cursor: "pointer",
                fontSize: 13,
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Toolbar */}
      <div className="reception-card reception-card--toolbar">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            justifyContent: "space-between",
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <Button icon={<DownloadOutlined />}>Xuất Excel</Button>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Select
              placeholder="Chọn khách hàng"
              style={{ width: 180 }}
              allowClear
              options={[]}
            />
            <Select
              placeholder="Chọn bác sĩ"
              style={{ width: 160 }}
              allowClear
              options={[]}
            />
            <Input
              prefix={<SearchOutlined />}
              placeholder="Tìm kiếm..."
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              style={{ width: 200 }}
              allowClear
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="reception-card reception-card--content">
        <Table
          columns={columns}
          dataSource={[]}
          rowKey="id"
          pagination={{
            pageSize: 20,
            showSizeChanger: true,
            pageSizeOptions: ["5", "10", "20", "25", "50", "100"],
            showTotal: (total) => `Hiển thị 0 trên ${total} mẫu labo`,
          }}
          locale={{ emptyText: "Không có dữ liệu" }}
          size="middle"
        />
      </div>
    </>
  );
}

function SupplierView() {
  const [keyword, setKeyword] = useState("");

  const columns = [
    { title: "Tên labo", dataIndex: "name", key: "name" },
    { title: "Số điện thoại", dataIndex: "phone", key: "phone" },
    { title: "Email", dataIndex: "email", key: "email" },
    { title: "Địa chỉ", dataIndex: "address", key: "address" },
    { title: "Lần cập nhật cuối", dataIndex: "updatedAt", key: "updatedAt" },
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
    <>
      <div className="reception-card reception-card--toolbar">
        <div style={{ display: "flex", gap: 8, justifyContent: "space-between" }}>
          <Input
            prefix={<SearchOutlined />}
            placeholder="Tìm kiếm Labo..."
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            style={{ width: 280 }}
            allowClear
          />
          <Button type="primary">Tạo nhà cung cấp</Button>
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
            showTotal: (total, range) =>
              `Hiển thị ${range[0]}–${range[1]} trên ${total} nhà cung cấp`,
          }}
          locale={{ emptyText: "Không có dữ liệu" }}
          size="middle"
        />
      </div>
    </>
  );
}

function SimpleCatalogView({
  searchPlaceholder,
  createLabel,
  columnLabel,
  paginationUnit,
}: {
  searchPlaceholder: string;
  createLabel: string;
  columnLabel: string;
  paginationUnit: string;
}) {
  const [keyword, setKeyword] = useState("");

  const columns = [
    { title: columnLabel, dataIndex: "name", key: "name" },
    { title: "Cập nhật gần nhất", dataIndex: "updatedAt", key: "updatedAt" },
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
    <>
      <div className="reception-card reception-card--toolbar">
        <div style={{ display: "flex", gap: 8, justifyContent: "space-between" }}>
          <Input
            prefix={<SearchOutlined />}
            placeholder={searchPlaceholder}
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            style={{ width: 280 }}
            allowClear
          />
          <Button type="primary">{createLabel}</Button>
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
            showTotal: (total, range) =>
              `Hiển thị ${range[0]}–${range[1]} trên ${total} ${paginationUnit}`,
          }}
          locale={{ emptyText: "Không có dữ liệu" }}
          size="middle"
        />
      </div>
    </>
  );
}

function ServiceMaterialView() {
  const [keyword, setKeyword] = useState("");

  const columns = [
    { title: "Vật liệu", dataIndex: "name", key: "name" },
    { title: "Nhóm phân loại", dataIndex: "category", key: "category" },
    { title: "Cập nhật gần nhất", dataIndex: "updatedAt", key: "updatedAt" },
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
      {/* Left panel: supplier list */}
      <div
        className="reception-card"
        style={{ width: 240, minWidth: 200, padding: 16, flexShrink: 0 }}
      >
        <div style={{ marginBottom: 12 }}>
          <Button type="dashed" block>
            Thêm Mới
          </Button>
        </div>
        <div
          style={{
            color: "#8c8c8c",
            fontSize: 13,
            textAlign: "center",
            paddingTop: 24,
          }}
        >
          Chưa có nhà cung cấp
        </div>
      </div>

      {/* Right panel */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 16 }}>
        <div className="reception-card reception-card--toolbar">
          <div style={{ display: "flex", gap: 8, justifyContent: "space-between" }}>
            <Button type="primary">Tạo vật liệu</Button>
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
            pagination={{
              pageSize: 20,
              showSizeChanger: true,
              pageSizeOptions: ["5", "10", "20", "25", "50", "100"],
              showTotal: (total, range) =>
                `Hiển thị ${range[0]}–${range[1]} trên ${total} vật liệu`,
            }}
            locale={{ emptyText: "Không có dữ liệu" }}
            size="middle"
          />
        </div>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export function LaboPage() {
  const [activeTab, setActiveTab] = useState<LaboSubRoute>("mau-labo");

  const renderContent = () => {
    switch (activeTab) {
      case "mau-labo":
        return <MauLaboView />;
      case "supplier":
        return <SupplierView />;
      case "bite":
        return (
          <SimpleCatalogView
            searchPlaceholder="Tìm kiếm khớp cắn..."
            createLabel="Tạo khớp cắn"
            columnLabel="Khớp cắn Labo"
            paginationUnit="mục"
          />
        );
      case "finish-line":
        return (
          <SimpleCatalogView
            searchPlaceholder="Tìm kiếm đường hoàn tất..."
            createLabel="Tạo đường hoàn tất"
            columnLabel="Đường hoàn tất"
            paginationUnit="mục"
          />
        );
      case "nhip":
        return (
          <SimpleCatalogView
            searchPlaceholder="Tìm kiếm kiểu nhịp..."
            createLabel="Tạo kiểu nhịp"
            columnLabel="Kiểu nhịp Labo"
            paginationUnit="mục"
          />
        );
      case "service-material":
        return <ServiceMaterialView />;
      default:
        return null;
    }
  };

  return (
    <div className="reception-page">
      {/* Horizontal sub-nav */}
      <div className="reception-card reception-card--tabs">
        <div style={{ display: "flex", gap: 0, flexWrap: "wrap" }}>
          {SUB_ROUTES.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                padding: "8px 18px",
                border: "none",
                borderBottom:
                  activeTab === tab.key
                    ? "2px solid #1677ff"
                    : "2px solid transparent",
                background: "none",
                color: activeTab === tab.key ? "#1677ff" : "#595959",
                fontWeight: activeTab === tab.key ? 600 : 400,
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

      {renderContent()}
    </div>
  );
}
