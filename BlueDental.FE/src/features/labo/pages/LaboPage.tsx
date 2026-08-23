import { useState } from "react";
import { Button, Input, Table, Tag, message } from "antd";
import { SearchOutlined, DownloadOutlined } from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import {
  LABO_FILTER,
  LABO_FILTER_LABELS,
  LABO_STATUS,
  LABO_STATUS_CONFIG,
  useLaboOrders,
  useLaboStats,
  useReceiveLaboOrder,
  useSendLaboOrder,
  type LaboOrderDto,
  type LaboSampleFilter,
} from "../api/laboApi";
import { useCurrentBranchId } from "@/lib/clinicBranch";
import { extractApiError } from "@/lib/apiError";
import { formatDate } from "@/utils/format";

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

const MAU_LABO_FILTER_TABS: { key: LaboSampleFilter; label: string }[] = (
  [LABO_FILTER.All, LABO_FILTER.AwaitingReturn, LABO_FILTER.Overdue, LABO_FILTER.Returned] as LaboSampleFilter[]
).map((key) => ({ key, label: LABO_FILTER_LABELS[key] }));

// ── Sub-views ──────────────────────────────────────────────────────────────

function MauLaboView() {
  const branchId = useCurrentBranchId();
  const [sampleFilter, setSampleFilter] = useState<LaboSampleFilter>(LABO_FILTER.All);
  const [keyword, setKeyword] = useState("");

  const listParams = {
    branchId,
    sampleFilter,
    filter: keyword.trim() || undefined,
    maxResultCount: 100,
  };

  const { data: page, isLoading } = useLaboOrders(listParams);
  const { data: stats } = useLaboStats({ branchId });

  const sendOrder = useSendLaboOrder();
  const receiveOrder = useReceiveLaboOrder();

  const run = async (action: Promise<unknown>, successMessage: string) => {
    try {
      await action;
      message.success(successMessage);
    } catch (error) {
      message.error(extractApiError(error));
    }
  };

  /** Counts for the filter chips, so each one says how much it will show. */
  const filterCounts: Record<LaboSampleFilter, number> = {
    [LABO_FILTER.All]: stats?.total ?? 0,
    [LABO_FILTER.AwaitingReturn]: stats?.awaitingReturn ?? 0,
    [LABO_FILTER.Overdue]: stats?.overdue ?? 0,
    [LABO_FILTER.Returned]: stats?.returned ?? 0,
  };

  const columns: ColumnsType<LaboOrderDto> = [
    {
      title: "Nhà cung cấp / Ngày tạo",
      key: "supplier",
      width: 200,
      render: (_, row) => (
        <>
          <div>{row.supplierName ?? row.labProviderName}</div>
          <div style={{ fontSize: 12, color: "#6B7280" }}>{formatDate(row.creationTime)}</div>
        </>
      ),
    },
    {
      title: "Tên khách hàng",
      dataIndex: "patientName",
      key: "patientName",
      width: 180,
      render: (value: string | null) => value ?? "—",
    },
    {
      title: "Ngày gửi / Tình trạng mẫu",
      key: "sent",
      width: 190,
      render: (_, row) => (
        <>
          <div>{row.sentAt ? formatDate(row.sentAt) : "Chưa gửi"}</div>
          <Tag color={row.isAwaitingReturn ? "orange" : row.receivedAt ? "green" : "default"}>
            {row.receivedAt ? "Đã nhận hàng" : row.isAwaitingReturn ? "Chưa nhận" : "Chưa gửi"}
          </Tag>
        </>
      ),
    },
    {
      title: "Ngày giao / Trạng thái Labo",
      key: "due",
      width: 200,
      render: (_, row) => (
        <>
          <div style={{ color: row.isOverdue ? "#EF4444" : undefined }}>
            {row.dueDate ? formatDate(row.dueDate) : "—"}
            {row.isOverdue && " (trễ)"}
          </div>
          <Tag color={LABO_STATUS_CONFIG[row.status].color}>
            {LABO_STATUS_CONFIG[row.status].label}
          </Tag>
        </>
      ),
    },
    {
      title: "Bác sĩ chỉ định",
      dataIndex: "dentistName",
      key: "dentistName",
      width: 150,
      render: (value: string | null) => value ?? "—",
    },
    {
      title: "Vật liệu",
      dataIndex: "materialName",
      key: "materialName",
      width: 150,
      render: (value: string | null) => value ?? "—",
    },
    {
      title: "Răng",
      dataIndex: "toothNumbers",
      key: "toothNumbers",
      width: 120,
      render: (value: string | null) => value ?? "—",
    },
    {
      title: "File phòng khám gửi về",
      dataIndex: "attachmentUrl",
      key: "attachmentUrl",
      width: 180,
      render: (value: string | null) =>
        value ? (
          <a href={value} target="_blank" rel="noreferrer">
            Tệp đính kèm
          </a>
        ) : (
          "—"
        ),
    },
    {
      title: "Thao tác",
      key: "actions",
      width: 160,
      render: (_, row) => (
        <>
          {row.status === LABO_STATUS.Draft && (
            <Button
              type="link"
              size="small"
              onClick={() => run(sendOrder.mutateAsync(row.id), "Đã gửi mẫu cho Labo")}
            >
              Gửi mẫu
            </Button>
          )}
          {row.isAwaitingReturn && (
            <Button
              type="link"
              size="small"
              onClick={() => run(receiveOrder.mutateAsync(row.id), "Đã nhận hàng")}
            >
              Nhận hàng
            </Button>
          )}
        </>
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
              onClick={() => setSampleFilter(tab.key)}
              style={{
                padding: "8px 16px",
                border: "none",
                borderBottom:
                  sampleFilter === tab.key
                    ? "2px solid #1677ff"
                    : "2px solid transparent",
                background: "none",
                color: sampleFilter === tab.key ? "#1677ff" : "#595959",
                fontWeight: sampleFilter === tab.key ? 600 : 400,
                cursor: "pointer",
                fontSize: 13,
              }}
            >
              {tab.label} ({filterCounts[tab.key]})
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
          <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
            <Button icon={<DownloadOutlined />}>Xuất Excel</Button>
            <span style={{ fontSize: 13, color: "#5A6B82" }}>
              Đơn hàng mới: {stats?.new ?? 0} · Tiếp tục công đoạn: {stats?.continueStage ?? 0} ·
              Bảo hành: {stats?.guarantee ?? 0}
            </span>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Input
              prefix={<SearchOutlined />}
              placeholder="Tìm mã mẫu hoặc nhà cung cấp..."
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              style={{ width: 240 }}
              allowClear
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="reception-card reception-card--content">
        <Table<LaboOrderDto>
          columns={columns}
          dataSource={page?.items ?? []}
          loading={isLoading}
          rowKey="id"
          scroll={{ x: "max-content" }}
          pagination={{
            pageSize: 20,
            showSizeChanger: true,
            pageSizeOptions: ["5", "10", "20", "25", "50", "100"],
            showTotal: (total, range) => `Hiển thị ${range[0]}–${range[1]} trên ${total} mẫu labo`,
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
