import { useState } from "react";
import { Button, Input, Table, Tag, message } from "antd";
import { SearchOutlined, DownloadOutlined } from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import {
  LABO_FILTER,
  laboFilterLabels,
  LABO_STATUS,
  laboStatusConfig,
  useLaboOrders,
  useLaboStats,
  useReceiveLaboOrder,
  useSendLaboOrder,
  type LaboOrderDto,
  type LaboSampleFilter,
} from "../api/laboApi";
import { useCurrentBranchId } from "@/lib/clinicBranch";
import { downloadFile } from "@/lib/download";
import { extractApiError } from "@/lib/apiError";
import { formatDate } from "@/utils/format";
import { t } from "@/lib/i18n";

// ── Types ──────────────────────────────────────────────────────────────────

type LaboSubRoute =
  | "mau-labo"
  | "supplier"
  | "bite"
  | "finish-line"
  | "nhip"
  | "service-material";

// ── Constants ──────────────────────────────────────────────────────────────

const subRoutes = (): { key: LaboSubRoute; label: string }[] => [
  { key: "mau-labo", label: t("Mẫu Labo") },
  { key: "supplier", label: t("Nhà cung cấp Labo") },
  { key: "bite", label: t("Khớp cắn Labo") },
  { key: "finish-line", label: t("Đường hoàn tất") },
  { key: "nhip", label: t("Kiểu nhịp Labo") },
  { key: "service-material", label: t("Dịch vụ - vật liệu") },
];

const MAU_LABO_FILTER_TABS: { key: LaboSampleFilter; label: string }[] = (
  [LABO_FILTER.All, LABO_FILTER.AwaitingReturn, LABO_FILTER.Overdue, LABO_FILTER.Returned] as LaboSampleFilter[]
).map((key) => ({ key, label: laboFilterLabels()[key] }));

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
      title: t("Nhà cung cấp / Ngày tạo"),
      key: "supplier",
      width: 200,
      render: (_, row) => (
        <>
          <div>{row.supplierName ?? row.labProviderName}</div>
          <div style={{ fontSize: 12, color: "#6f7c90" }}>{formatDate(row.creationTime)}</div>
        </>
      ),
    },
    {
      title: t("Tên khách hàng"),
      dataIndex: "patientName",
      key: "patientName",
      width: 180,
      render: (value: string | null) => value ?? "—",
    },
    {
      title: t("Ngày gửi / Tình trạng mẫu"),
      key: "sent",
      width: 190,
      render: (_, row) => (
        <>
          <div>{row.sentAt ? formatDate(row.sentAt) : t("Chưa gửi")}</div>
          <Tag color={row.isAwaitingReturn ? "orange" : row.receivedAt ? "green" : "default"}>
            {row.receivedAt ? t("Đã nhận hàng") : row.isAwaitingReturn ? t("Chưa nhận") : t("Chưa gửi")}
          </Tag>
        </>
      ),
    },
    {
      title: t("Ngày giao / Trạng thái Labo"),
      key: "due",
      width: 200,
      render: (_, row) => (
        <>
          <div style={{ color: row.isOverdue ? "#ef4d4d" : undefined }}>
            {row.dueDate ? formatDate(row.dueDate) : "—"}
            {row.isOverdue && t(" (trễ)")}
          </div>
          <Tag color={laboStatusConfig()[row.status].color}>
            {laboStatusConfig()[row.status].label}
          </Tag>
        </>
      ),
    },
    {
      title: t("Bác sĩ chỉ định"),
      dataIndex: "dentistName",
      key: "dentistName",
      width: 150,
      render: (value: string | null) => value ?? "—",
    },
    {
      title: t("Vật liệu"),
      dataIndex: "materialName",
      key: "materialName",
      width: 150,
      render: (value: string | null) => value ?? "—",
    },
    {
      title: t("Răng"),
      dataIndex: "toothNumbers",
      key: "toothNumbers",
      width: 120,
      render: (value: string | null) => value ?? "—",
    },
    {
      title: t("File phòng khám gửi về"),
      dataIndex: "attachmentUrl",
      key: "attachmentUrl",
      width: 180,
      render: (value: string | null) =>
        value ? (
          <a href={value} target="_blank" rel="noreferrer">
            {t("Tệp đính kèm")}
          </a>
        ) : (
          "—"
        ),
    },
    {
      title: t("Thao tác"),
      key: "actions",
      width: 160,
      render: (_, row) => (
        <>
          {row.status === LABO_STATUS.Draft && (
            <Button
              type="link"
              size="small"
              onClick={() => run(sendOrder.mutateAsync(row.id), t("Đã gửi mẫu cho Labo"))}
            >
              {t("Gửi mẫu")}
            </Button>
          )}
          {row.isAwaitingReturn && (
            <Button
              type="link"
              size="small"
              onClick={() => run(receiveOrder.mutateAsync(row.id), t("Đã nhận hàng"))}
            >
              {t("Nhận hàng")}
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
                    ? "2px solid #1c3566"
                    : "2px solid transparent",
                background: "none",
                color: sampleFilter === tab.key ? "#1c3566" : "#6f7c90",
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
            <Button
              icon={<DownloadOutlined />}
              onClick={() => void downloadFile("/v1/app/labo-orders/excel", "labo.xlsx", listParams)}
            >
              {t("Xuất Excel")}
            </Button>
            <span style={{ fontSize: 13, color: "#6f7c90" }}>
              {t("Đơn hàng mới:")} {stats?.new ?? 0} {t("· Tiếp tục công đoạn:")} {stats?.continueStage ?? 0} {t("· Bảo hành:")} {stats?.guarantee ?? 0}
            </span>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Input
              prefix={<SearchOutlined />}
              placeholder={t("Tìm mã mẫu hoặc nhà cung cấp...")}
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
            showTotal: (total, range) => t("Hiển thị {0}–{1} trên {2} mẫu labo", range[0], range[1], total),
          }}
          locale={{ emptyText: t("Không có dữ liệu") }}
          size="middle"
        />
      </div>
    </>
  );
}

function SupplierView() {
  const [keyword, setKeyword] = useState("");

  const columns = [
    { title: t("Tên labo"), dataIndex: "name", key: "name" },
    { title: t("Số điện thoại"), dataIndex: "phone", key: "phone" },
    { title: "Email", dataIndex: "email", key: "email" },
    { title: t("Địa chỉ"), dataIndex: "address", key: "address" },
    { title: t("Lần cập nhật cuối"), dataIndex: "updatedAt", key: "updatedAt" },
    {
      title: t("Thao tác"),
      key: "actions",
      render: () => (
        <div style={{ display: "flex", gap: 8 }}>
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
            placeholder={t("Tìm kiếm Labo...")}
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            style={{ width: 280 }}
            allowClear
          />
          <Button type="primary">{t("Tạo nhà cung cấp")}</Button>
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
              t("Hiển thị {0}–{1} trên {2} nhà cung cấp", range[0], range[1], total),
          }}
          locale={{ emptyText: t("Không có dữ liệu") }}
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
    { title: t("Cập nhật gần nhất"), dataIndex: "updatedAt", key: "updatedAt" },
    {
      title: t("Thao tác"),
      key: "actions",
      render: () => (
        <div style={{ display: "flex", gap: 8 }}>
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
              t("Hiển thị {0}–{1} trên {2} {3}", range[0], range[1], total, paginationUnit),
          }}
          locale={{ emptyText: t("Không có dữ liệu") }}
          size="middle"
        />
      </div>
    </>
  );
}

function ServiceMaterialView() {
  const [keyword, setKeyword] = useState("");

  const columns = [
    { title: t("Vật liệu"), dataIndex: "name", key: "name" },
    { title: t("Nhóm phân loại"), dataIndex: "category", key: "category" },
    { title: t("Cập nhật gần nhất"), dataIndex: "updatedAt", key: "updatedAt" },
    {
      title: t("Thao tác"),
      key: "actions",
      render: () => (
        <div style={{ display: "flex", gap: 8 }}>
          <Button size="small">{t("Chỉnh sửa")}</Button>
          <Button size="small" danger>{t("Xoá")}</Button>
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
            {t("Thêm Mới")}
          </Button>
        </div>
        <div
          style={{
            color: "#7d8a9c",
            fontSize: 13,
            textAlign: "center",
            paddingTop: 24,
          }}
        >
          {t("Chưa có nhà cung cấp")}
        </div>
      </div>

      {/* Right panel */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 16 }}>
        <div className="reception-card reception-card--toolbar">
          <div style={{ display: "flex", gap: 8, justifyContent: "space-between" }}>
            <Button type="primary">{t("Tạo vật liệu")}</Button>
            <Input
              prefix={<SearchOutlined />}
              placeholder={t("Tìm kiếm...")}
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
                t("Hiển thị {0}–{1} trên {2} vật liệu", range[0], range[1], total),
            }}
            locale={{ emptyText: t("Không có dữ liệu") }}
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
            searchPlaceholder={t("Tìm kiếm khớp cắn...")}
            createLabel={t("Tạo khớp cắn")}
            columnLabel={t("Khớp cắn Labo")}
            paginationUnit={t("mục")}
          />
        );
      case "finish-line":
        return (
          <SimpleCatalogView
            searchPlaceholder={t("Tìm kiếm đường hoàn tất...")}
            createLabel={t("Tạo đường hoàn tất")}
            columnLabel={t("Đường hoàn tất")}
            paginationUnit={t("mục")}
          />
        );
      case "nhip":
        return (
          <SimpleCatalogView
            searchPlaceholder={t("Tìm kiếm kiểu nhịp...")}
            createLabel={t("Tạo kiểu nhịp")}
            columnLabel={t("Kiểu nhịp Labo")}
            paginationUnit={t("mục")}
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
          {subRoutes().map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                padding: "8px 18px",
                border: "none",
                borderBottom:
                  activeTab === tab.key
                    ? "2px solid #1c3566"
                    : "2px solid transparent",
                background: "none",
                color: activeTab === tab.key ? "#1c3566" : "#6f7c90",
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
