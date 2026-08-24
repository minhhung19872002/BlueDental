import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Tabs, Row, Col, Button, Select, Segmented, Spin, Table, Typography, Tag, Modal, Input, Popconfirm, message } from "antd";
import { useStaffList } from "@/features/staff/api/staffQueries";
import { DownloadOutlined, LeftOutlined, RightOutlined, PlusOutlined } from "@ant-design/icons";
import dayjs, { type Dayjs } from "dayjs";
import { formatDate, formatVND } from "@/utils/format";
import { exportToExcel } from "@/utils/exportExcel";
import { useReportSummary, useRevenueReport, useExpenseReport } from "../api/reportingApi";
import { useCurrentBranchId } from "@/lib/clinicBranch";
import { useAuthStore } from "@/features/auth/store/authStore";
import { extractApiError } from "@/lib/apiError";
import { SalesEntryModal } from "../components/SalesEntryModal";
import { CashflowEntryModal } from "../components/CashflowEntryModal";
import { t } from "@/lib/i18n";
import { PageHeader } from "@/components/PageHeader";

/** The translator, so helpers below can take it as a parameter. */
type Translate = (vietnamese: string, ...params: (string | number)[]) => string;
import {
  CASH_HOLDING_LABELS,
  CASH_TRANSACTION_LABELS,
  CASH_TRANSACTION_TYPE,
  PAYMENT_CHANNEL_LABELS,
  SALES_APPROVAL_STATUS,
  SALES_ENTRY_TYPE,
  useApproveSalesEntry,
  useCashflowEntries,
  useCashflowOverview,
  useDeleteSalesEntry,
  useRejectSalesEntry,
  useSalesEntries,
  useSalesStats,
  type SalesEntryDto,
  type CashHolding,
  type CashTransactionType,
  type PaymentChannel,
  type SalesApprovalStatus,
  type SalesEntryType,
} from "../api/financeApi";

const { Text } = Typography;

type DateMode = "day" | "week" | "month" | "year";

interface PeriodRange {
  fromDate: string;
  toDate: string;
}

/** The toolbar's Day/Week/Month/Year switch resolved into an inclusive range. */
function resolvePeriod(currentDate: Dayjs, dateMode: DateMode): PeriodRange {
  const unit = dateMode === "day" ? "day" : dateMode === "week" ? "week" : dateMode === "month" ? "month" : "year";
  return {
    fromDate: currentDate.startOf(unit).format("YYYY-MM-DD"),
    toDate: currentDate.endOf(unit).format("YYYY-MM-DD"),
  };
}

function buildCashflowColumns(
  t: Translate,
  approvalConfig: Record<SalesApprovalStatus, { label: string; color: string } | null>,
  actions?: (row: SalesEntryDto) => React.ReactNode,
) {
  return [
    { title: t("Ngày"), dataIndex: "entryDate", key: "entryDate", width: 110, render: (v: string) => formatDate(v) },
    { title: t("Số phiếu"), dataIndex: "code", key: "code", width: 110 },
    { title: t("Loại"), dataIndex: "type", key: "type", width: 80,
      render: (v: SalesEntryType) => (
        <Tag color={v === SALES_ENTRY_TYPE.Income ? "green" : "red"}>
          {v === SALES_ENTRY_TYPE.Income ? t("Thu") : t("Chi")}
        </Tag>
      ) },
    { title: t("Danh mục"), dataIndex: "categoryName", key: "categoryName", width: 160,
      render: (v: string | null) => v ?? "—" },
    { title: t("Nội dung"), dataIndex: "description", key: "description" },
    { title: t("Thành tiền"), dataIndex: "amount", key: "amount", width: 140, align: "right" as const,
      render: (v: number, r: { type: SalesEntryType }) => (
        <Text style={{
          color: r.type === SALES_ENTRY_TYPE.Income ? "#10B981" : "#EF4444",
          fontVariantNumeric: "tabular-nums",
        }}>
          {r.type === SALES_ENTRY_TYPE.Income ? "+" : "-"}{formatVND(v ?? 0)} đ
        </Text>
      ) },
    { title: t("Phương thức"), dataIndex: "channel", key: "channel", width: 130,
      render: (v: PaymentChannel) => PAYMENT_CHANNEL_LABELS[v] },
    { title: t("Người thực hiện"), dataIndex: "staffName", key: "staffName", width: 160,
      render: (v: string | null) => v ?? "—" },
    { title: t("Duyệt"), dataIndex: "approvalStatus", key: "approvalStatus", width: 110,
      render: (v: SalesApprovalStatus) => {
        const config = approvalConfig[v];
        return config ? <Tag color={config.color}>{config.label}</Tag> : <Text type="secondary">—</Text>;
      } },
    ...(actions
      ? [{ title: t("Thao tác"), key: "actions", width: 200, render: (_: unknown, row: SalesEntryDto) => actions(row) }]
      : []),
  ];
}

function buildResultColumns(t: Translate) {
  return [
    { title: t("Danh mục"), dataIndex: "category", key: "category" },
    { title: t("Doanh thu"), dataIndex: "revenue", key: "revenue", width: 160, align: "right" as const,
      render: (v: number) => <Text style={{ fontVariantNumeric: "tabular-nums" }}>{formatVND(v ?? 0)} đ</Text> },
    { title: t("Chi phí"), dataIndex: "expense", key: "expense", width: 160, align: "right" as const,
      render: (v: number) => <Text style={{ color: "#EF4444", fontVariantNumeric: "tabular-nums" }}>{formatVND(v ?? 0)} đ</Text> },
    { title: t("Lợi nhuận"), dataIndex: "profit", key: "profit", width: 160, align: "right" as const,
      render: (v: number) => <Text style={{ color: "#10B981", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{formatVND(v ?? 0)} đ</Text> },
    { title: t("Tỷ lệ LN (%)"), dataIndex: "margin", key: "margin", width: 120, align: "right" as const,
      render: (v: number) => <Text style={{ color: v >= 0 ? "#10B981" : "#EF4444" }}>{v ?? 0}%</Text> },
  ];
}

function buildExpenseColumns(t: Translate) {
  return [
    { title: t("Ngày"), dataIndex: "date", key: "date", width: 110 },
    { title: t("Tên khách hàng"), dataIndex: "patientName", key: "patientName", width: 180 },
    { title: t("Nhân sự tư vấn"), dataIndex: "counselorName", key: "counselorName", width: 150 },
    { title: t("Bác sĩ tiếp nhận"), dataIndex: "doctorName", key: "doctorName", width: 150 },
    { title: t("Dịch vụ điều trị"), dataIndex: "serviceName", key: "serviceName" },
    { title: t("Số lượng"), dataIndex: "quantity", key: "quantity", width: 90, align: "right" as const },
    { title: t("Thành tiền"), dataIndex: "totalAmount", key: "totalAmount", width: 130, align: "right" as const, render: (v: number) => <Text style={{ fontVariantNumeric: "tabular-nums" }}>{formatVND(v ?? 0)} đ</Text> },
    { title: t("Đã thanh toán"), dataIndex: "paidAmount", key: "paidAmount", width: 130, align: "right" as const, render: (v: number) => <Text style={{ color: "#10B981", fontVariantNumeric: "tabular-nums" }}>{formatVND(v ?? 0)} đ</Text> },
  ];
}

function buildCashflowEntryColumns(t: Translate) {
  return [
    { title: t("Ngày"), dataIndex: "entryDate", key: "entryDate", width: 110, render: (v: string) => formatDate(v) },
    { title: t("Loại giao dịch"), dataIndex: "transactionType", key: "transactionType", width: 130,
      render: (v: CashTransactionType) => <Tag>{CASH_TRANSACTION_LABELS[v]}</Tag> },
    { title: t("Hình thức"), key: "holding", width: 200,
      render: (_: unknown, r: { fromHolding: CashHolding | null; toHolding: CashHolding | null }) => {
        const from = r.fromHolding ? CASH_HOLDING_LABELS[r.fromHolding] : null;
        const to = r.toHolding ? CASH_HOLDING_LABELS[r.toHolding] : null;
        if (from && to) return `${from} → ${to}`;
        return to ?? from ?? "—";
      } },
    { title: t("Danh mục"), dataIndex: "categoryName", key: "categoryName", width: 160,
      render: (v: string | null) => v ?? "—" },
    { title: t("Thành tiền"), dataIndex: "amount", key: "amount", width: 140, align: "right" as const,
      render: (v: number) => <Text style={{ fontVariantNumeric: "tabular-nums" }}>{formatVND(v ?? 0)} đ</Text> },
    { title: t("Người tạo"), dataIndex: "createdByStaffName", key: "createdByStaffName", width: 160,
      render: (v: string | null) => v ?? "—" },
    { title: t("Ghi chú"), dataIndex: "note", key: "note", render: (v: string | null) => v ?? "—" },
  ];
}

export function ReportPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  const activeTab = searchParams.get("tab") ?? "expense";
  const dateMode = (searchParams.get("dateMode") as DateMode) ?? "day";
  const currentDate = dayjs(searchParams.get("date") ?? undefined);
  const [subFilter, setSubFilter] = useState("service");
  const period = resolvePeriod(currentDate, dateMode);

  const REPORT_TABS = [
    { key: "expense",     label: t("Doanh số và lượt khách") },
    { key: "cashflow",    label: t("Quản lý thu chi") },
    { key: "result",      label: t("Kết quả kinh doanh") },
    { key: "cashflow-v2", label: t("Luân chuyển dòng tiền V2") },
  ];

  const SUB_FILTERS = [
    { key: "service",  label: t("Khách hàng phát sinh dịch vụ") },
    { key: "payment",  label: t("Thanh toán") },
    { key: "refund",   label: t("Hoàn tiền") },
    { key: "debt",     label: t("Dư nợ") },
  ];

  const startDate = currentDate.startOf(dateMode === "day" ? "day" : dateMode === "week" ? "week" : dateMode === "month" ? "month" : "year").format("YYYY-MM-DD");
  const endDate = currentDate.endOf(dateMode === "day" ? "day" : dateMode === "week" ? "week" : dateMode === "month" ? "month" : "year").format("YYYY-MM-DD");

  const { data: summary, isLoading: summaryLoading } = useReportSummary({ startDate, endDate });
  const { data: revenueData } = useRevenueReport({ startDate, endDate });
  const { data: expenseData, isLoading: expenseLoading } = useExpenseReport({ startDate, endDate });
  const { data: staffData } = useStaffList({ maxResultCount: 100, isActive: true });
  const doctorOptions = (staffData?.items ?? []).map((s) => ({
    value: s.id,
    label: s.name || s.userName,
  }));

  const expenseColumns = buildExpenseColumns(t);

  const setActiveTab = (tab: string) => {
    setSearchParams((p) => { p.set("tab", tab); return p; });
  };
  const setDateMode = (mode: DateMode) => {
    setSearchParams((p) => { p.set("dateMode", mode); return p; });
  };
  const setCurrentDate = (updater: (d: Dayjs) => Dayjs) => {
    setSearchParams((p) => {
      const next = updater(dayjs(p.get("date") ?? undefined));
      p.set("date", next.format("YYYY-MM-DD"));
      return p;
    });
  };

  const navigateDate = (dir: 1 | -1) => {
    const unit = dateMode === "day" ? "day" : dateMode === "week" ? "week" : dateMode === "month" ? "month" : "year";
    setCurrentDate((d) => d.add(dir, unit));
  };

  const handleExportRevenue = () => {
    if (!Array.isArray(revenueData) || revenueData.length === 0) return;
    exportToExcel(
      revenueData,
      [
        { header: t("Ngày"), key: "date" },
        { header: t("Doanh thu"), key: "totalRevenue", format: (v) => formatVND(Number(v ?? 0)) },
        { header: t("Bệnh nhân mới"), key: "newPatients", format: (v) => String(v ?? 0) },
        { header: t("Lịch hẹn khách hàng"), key: "appointments", format: (v) => String(v ?? 0) },
      ],
      `bao-cao-doanh-so-${dayjs().format("YYYYMMDD")}`,
    );
  };

  const displayDate = () => {
    if (dateMode === "day") return currentDate.format("DD/MM/YYYY");
    if (dateMode === "week") return `${currentDate.startOf("week").format("DD/MM")} – ${currentDate.endOf("week").format("DD/MM/YYYY")}`;
    if (dateMode === "month") return currentDate.format("MM/YYYY");
    return currentDate.format("YYYY");
  };

  return (
    <div className="reception-page">
      <PageHeader
        title={t("Báo cáo")}
        subtitle={t("Kỳ báo cáo theo khoảng thời gian đã chọn")}
      />

      {/* Main tab bar */}
      <div className="reception-card" style={{ padding: "0 16px" }}>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          style={{ marginBottom: 0 }}
          items={REPORT_TABS.map((tab) => ({ key: tab.key, label: tab.label }))}
        />
      </div>

      {/* Shared toolbar */}
      <div className="reception-card reception-card--toolbar">
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <Segmented
            value={dateMode}
            onChange={(v) => setDateMode(v as DateMode)}
            options={[
              { label: t("Ngày"),   value: "day" },
              { label: t("Tuần"),  value: "week" },
              { label: t("Tháng"), value: "month" },
              { label: t("Năm"),  value: "year" },
            ]}
          />
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <Button type="text" size="small" icon={<LeftOutlined />} onClick={() => navigateDate(-1)} />
            <span style={{ minWidth: 130, textAlign: "center", fontWeight: 600, fontSize: 14 }}>{displayDate()}</span>
            <Button type="text" size="small" icon={<RightOutlined />} onClick={() => navigateDate(1)} />
          </div>
          <Select placeholder={t("Bác sĩ điều trị")} allowClear style={{ minWidth: 180 }} options={doctorOptions} />
        </div>
      </div>

      {/* Tab content */}
      {activeTab === "expense" && (
        <>
          {/* Sub-filter pills */}
          <div className="reception-card reception-card--tabs">
            <div style={{ display: "flex", gap: 0 }}>
              {SUB_FILTERS.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setSubFilter(f.key)}
                  style={{
                    padding: "8px 14px", border: "none",
                    borderBottom: subFilter === f.key ? "2px solid #1677ff" : "2px solid transparent",
                    background: "none",
                    color: subFilter === f.key ? "#1677ff" : "#595959",
                    fontWeight: subFilter === f.key ? 600 : 400,
                    cursor: "pointer", fontSize: 13, whiteSpace: "nowrap",
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Quick stats + export */}
          <div className="reception-card reception-card--toolbar">
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <span style={{ fontSize: 13, color: "#5A6B82" }}>{t("Doanh số:")}</span>
              {expenseLoading ? <Spin size="small" /> : (
                <span style={{ fontWeight: 700, fontSize: 18, color: "#1B2A41" }}>
                  {formatVND(expenseData?.grandTotalAmount ?? 0)} đ
                </span>
              )}
              <Button icon={<DownloadOutlined />} style={{ marginLeft: "auto" }} onClick={handleExportRevenue}>{t("Xuất Excel")}</Button>
            </div>
          </div>

          {/* Table */}
          <div className="reception-card reception-card--content">
            <Table
              size="small"
              rowKey="id"
              columns={expenseColumns}
              dataSource={expenseData?.items ?? []}
              loading={expenseLoading}
              pagination={{
                pageSize: 20,
                showSizeChanger: true,
                pageSizeOptions: ["5", "10", "20", "25", "50", "100"],
                showTotal: (total, range) => t("Hiển thị {0}–{1} trên {2} dòng", range[0], range[1], total),
              }}
              locale={{ emptyText: t("Không có dữ liệu") }}
            />
          </div>

          {/* Summary cards */}
          <Row gutter={[12, 12]}>
            <Col xs={24} sm={12} md={6}>
              <div className="reception-card" style={{ padding: 16 }}>
                <div style={{ fontWeight: 600, fontSize: 13, color: "#1B2A41", marginBottom: 10 }}>{t("Thông tin lượt khách")}</div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                  <span style={{ color: "#5A6B82" }}>{t("Lượt khách")}</span>
                  <span style={{ fontWeight: 600 }}>{expenseLoading ? "…" : (expenseData?.totalCount ?? 0)} {t("lượt")}</span>
                </div>
              </div>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <div className="reception-card" style={{ padding: 16 }}>
                <div style={{ fontWeight: 600, fontSize: 13, color: "#1B2A41", marginBottom: 10 }}>{t("Thông tin lịch hẹn")}</div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                  <span style={{ color: "#5A6B82" }}>{t("Lịch hẹn khách hàng")}</span>
                  <span style={{ fontWeight: 600 }}>{summaryLoading ? "…" : (summary?.totalAppointments ?? 0)}</span>
                </div>
              </div>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <div className="reception-card" style={{ padding: 16 }}>
                <div style={{ fontWeight: 600, fontSize: 13, color: "#1B2A41", marginBottom: 10 }}>{t("Thông tin thanh toán")}</div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                  <span style={{ color: "#5A6B82" }}>{t("Doanh thu")}</span>
                  <span style={{ fontWeight: 600, color: "#10B981" }}>
                    {expenseLoading ? "…" : formatVND(expenseData?.grandTotalAmount ?? 0)} đ
                  </span>
                </div>
              </div>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <div className="reception-card" style={{ padding: 16 }}>
                <div style={{ fontWeight: 600, fontSize: 13, color: "#1B2A41", marginBottom: 10 }}>{t("TB doanh thu / KH")}</div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                  <span style={{ color: "#5A6B82" }}>{t("Trung bình")}</span>
                  <span style={{ fontWeight: 600 }}>
                    {expenseLoading ? "…" : formatVND(
                      (expenseData?.totalCount ?? 0) > 0
                        ? (expenseData?.grandTotalAmount ?? 0) / (expenseData?.totalCount ?? 1)
                        : 0
                    )} đ
                  </span>
                </div>
              </div>
            </Col>
          </Row>
        </>
      )}

      {activeTab === "cashflow" && <CashflowTab period={period} />}
      {activeTab === "result" && <BusinessResultTab />}
      {activeTab === "cashflow-v2" && <CashflowV2Tab period={period} />}
    </div>
  );
}

function buildApprovalConfig(t: Translate): Record<SalesApprovalStatus, { label: string; color: string } | null> {
  return {
    [SALES_APPROVAL_STATUS.NotRequired]: null,
    [SALES_APPROVAL_STATUS.Pending]:  { label: t("Chờ duyệt"),  color: "gold" },
    [SALES_APPROVAL_STATUS.Approved]: { label: t("Đã duyệt"), color: "green" },
    [SALES_APPROVAL_STATUS.Rejected]: { label: t("Từ chối"), color: "red" },
  };
}

function CashflowTab({ period }: { period: PeriodRange }) {
  const branchId = useCurrentBranchId();
  const currentUserId = useAuthStore((s) => s.user?.id);
  const [typeFilter, setTypeFilter] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<SalesEntryDto | null>(null);

  const approveEntry = useApproveSalesEntry();
  const rejectEntry = useRejectSalesEntry();
  const deleteEntry = useDeleteSalesEntry();

  const typeParam: SalesEntryType | undefined =
    typeFilter === "thu" ? SALES_ENTRY_TYPE.Income
    : typeFilter === "chi" ? SALES_ENTRY_TYPE.Expense
    : undefined;

  const baseParams = { clinicBranchId: branchId, ...period };
  const { data: stats } = useSalesStats(baseParams);
  const { data: page, isLoading } = useSalesEntries({
    ...baseParams,
    type: typeParam,
    maxResultCount: 100,
  });

  const handleApprove = async (row: SalesEntryDto) => {
    if (!currentUserId) return;
    try {
      await approveEntry.mutateAsync({ id: row.id, staffId: currentUserId });
      message.success(t("Đã duyệt"));
    } catch (error) {
      message.error(extractApiError(error));
    }
  };

  const handleReject = (row: SalesEntryDto) => {
    if (!currentUserId) return;
    let reason = "";

    Modal.confirm({
      title: t("Từ chối phiếu {0}", row.code),
      content: (
        <Input.TextArea
          rows={3}
          placeholder={t("Lý do từ chối")}
          onChange={(e) => { reason = e.target.value; }}
        />
      ),
      okText: t("Từ chối"),
      cancelText: t("Hủy"),
      onOk: async () => {
        if (!reason.trim()) {
          message.error(t("Vui lòng nhập lý do từ chối."));
          throw new Error("missing reason");
        }
        try {
          await rejectEntry.mutateAsync({ id: row.id, staffId: currentUserId, reason: reason.trim() });
          message.success(t("Từ chối"));
        } catch (error) {
          message.error(extractApiError(error));
          throw error;
        }
      },
    });
  };

  const CASHFLOW_TYPES = [
    { key: "all", label: t("Tất cả") },
    { key: "thu", label: t("Thu") },
    { key: "chi", label: t("Chi") },
  ];

  const summaryCards = [
    { label: t("Tổng thu"),     value: stats?.totalIncome  ?? 0, color: "#10B981" },
    { label: t("Tổng chi"),    value: stats?.totalExpense ?? 0, color: "#EF4444" },
    { label: t("Lợi nhuận ước tính"), value: stats?.net          ?? 0, color: "#1E70E6" },
  ];

  const columns = buildCashflowColumns(t, buildApprovalConfig(t), (row) => (
    <>
      {row.approvalStatus === SALES_APPROVAL_STATUS.Pending && (
        <>
          <Button type="link" size="small" onClick={() => handleApprove(row)}>{t("Duyệt")}</Button>
          <Button type="link" size="small" danger onClick={() => handleReject(row)}>{t("Từ chối")}</Button>
        </>
      )}
      {row.approvalStatus !== SALES_APPROVAL_STATUS.Approved && (
        <>
          <Button type="link" size="small" onClick={() => { setEditing(row); setModalOpen(true); }}>
            {t("Chỉnh sửa")}
          </Button>
          <Popconfirm
            title={t("Xoá phiếu này?")}
            okText={t("Xóa")}
            cancelText={t("Hủy")}
            onConfirm={async () => {
              try {
                await deleteEntry.mutateAsync(row.id);
                message.success(t("Xóa thành công"));
              } catch (error) {
                message.error(extractApiError(error));
              }
            }}
          >
            <Button type="link" size="small" danger>{t("Xóa")}</Button>
          </Popconfirm>
        </>
      )}
    </>
  ));

  return (
    <>
      <div className="reception-card reception-card--tabs">
        <div style={{ display: "flex", gap: 0 }}>
          {CASHFLOW_TYPES.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setTypeFilter(f.key)}
              style={{
                padding: "8px 14px", border: "none",
                borderBottom: typeFilter === f.key ? "2px solid #1677ff" : "2px solid transparent",
                background: "none",
                color: typeFilter === f.key ? "#1677ff" : "#595959",
                fontWeight: typeFilter === f.key ? 600 : 400,
                cursor: "pointer", fontSize: 13, whiteSpace: "nowrap",
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <Row gutter={[12, 12]} style={{ margin: "12px 0" }}>
        {summaryCards.map((c) => (
          <Col key={c.label} xs={24} sm={8}>
            <div className="reception-card" style={{ padding: "16px 20px" }}>
              <div style={{ fontSize: 12, color: "#5A6B82", marginBottom: 4 }}>{c.label}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: c.color, fontVariantNumeric: "tabular-nums" }}>
                {formatVND(c.value)} đ
              </div>
            </div>
          </Col>
        ))}
      </Row>

      {(stats?.pendingExpenseCount ?? 0) > 0 && (
        <div className="reception-card" style={{ padding: "10px 16px", marginBottom: 12 }}>
          <Text style={{ fontSize: 13, color: "#B45309" }}>
            {t("{0} phiếu chi đang chờ duyệt ({1} đ) — chưa được tính vào tổng chi.", stats?.pendingExpenseCount ?? 0, formatVND(stats?.pendingExpense ?? 0))}
          </Text>
        </div>
      )}

      <div className="reception-card reception-card--toolbar">
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => { setEditing(null); setModalOpen(true); }}
          >
            {t("Thêm mới")}
          </Button>
          <Button icon={<DownloadOutlined />} style={{ marginLeft: "auto" }}>{t("Xuất Excel")}</Button>
        </div>
      </div>

      <div className="reception-card reception-card--content">
        <Table
          size="small"
          rowKey="id"
          loading={isLoading}
          columns={columns}
          dataSource={page?.items ?? []}
          pagination={{
            pageSize: 20,
            showTotal: (total, range) => t("Hiển thị {0}–{1} trên {2} dòng", range[0], range[1], total),
          }}
          locale={{ emptyText: t("Không có dữ liệu") }}
        />
      </div>

      <SalesEntryModal
        open={modalOpen}
        entry={editing}
        defaultType={typeFilter === "chi" ? SALES_ENTRY_TYPE.Expense : SALES_ENTRY_TYPE.Income}
        onClose={() => { setModalOpen(false); setEditing(null); }}
      />
    </>
  );
}

function CashflowV2Tab({ period }: { period: PeriodRange }) {
  const branchId = useCurrentBranchId();
  const params = { clinicBranchId: branchId, ...period };
  const [cashModal, setCashModal] = useState<CashTransactionType | null>(null);

  const { data: overview } = useCashflowOverview(params);
  const { data: page, isLoading } = useCashflowEntries({ ...params, maxResultCount: 100 });

  const cashflowEntryColumns = buildCashflowEntryColumns(t);

  // Panel order and wording follow the reference "Luân chuyển dòng tiền V2" tab.
  const balancePanels = [
    { label: t("Tổng Tiền"),          value: overview?.balance.total           ?? 0, color: "#1B2A41" },
    { label: t("Tổng Tiền Mặt"),           value: overview?.balance.cash            ?? 0, color: "#10B981" },
    { label: t("Tổng Chuyển Khoản"),       value: overview?.balance.bank            ?? 0, color: "#1E70E6" },
    { label: t("Đang Giữ Hộ Khách"),  value: overview?.balance.customerPrepaid ?? 0, color: "#F59E0B" },
  ];

  return (
    <>
      <Row gutter={[12, 12]} style={{ margin: "12px 0" }}>
        {balancePanels.map((panel) => (
          <Col key={panel.label} xs={24} sm={12} md={6}>
            <div className="reception-card" style={{ padding: "16px 20px" }}>
              <div style={{ fontSize: 12, color: "#5A6B82", marginBottom: 4 }}>{panel.label}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: panel.color, fontVariantNumeric: "tabular-nums" }}>
                {formatVND(panel.value)} đ
              </div>
            </div>
          </Col>
        ))}
      </Row>

      <div className="reception-card reception-card--toolbar">
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <Button type="primary" onClick={() => setCashModal(CASH_TRANSACTION_TYPE.Deposit)}>
            {t("Nạp")}
          </Button>
          <Button onClick={() => setCashModal(CASH_TRANSACTION_TYPE.Withdraw)}>
            {t("Rút")}
          </Button>
          <Button onClick={() => setCashModal(CASH_TRANSACTION_TYPE.Transfer)}>
            {t("Luân chuyển")}
          </Button>
          <Text style={{ fontSize: 13, color: "#5A6B82", marginLeft: 12 }}>
            {t("Nạp")}: {formatVND(overview?.totalDeposit ?? 0)} đ
            {" · "}
            {t("Rút")}: {formatVND(overview?.totalWithdraw ?? 0)} đ
            {" · "}
            {t("Luân chuyển")}: {formatVND(overview?.totalTransfer ?? 0)} đ
          </Text>
          <Button icon={<DownloadOutlined />} style={{ marginLeft: "auto" }}>{t("Xuất Excel")}</Button>
        </div>
      </div>

      <div className="reception-card reception-card--content">
        <Table
          size="small"
          rowKey="id"
          loading={isLoading}
          columns={cashflowEntryColumns}
          dataSource={page?.items ?? []}
          pagination={{
            pageSize: 20,
            showTotal: (total, range) => t("Hiển thị {0}–{1} trên {2} giao dịch", range[0], range[1], total),
          }}
          locale={{ emptyText: t("Không có dữ liệu") }}
        />
      </div>

      {cashModal !== null && (
        <CashflowEntryModal
          open
          transactionType={cashModal}
          onClose={() => setCashModal(null)}
        />
      )}
    </>
  );
}

function BusinessResultTab() {
  const revenue = 0;
  const expense = 0;
  const profit = revenue - expense;
  const margin = revenue > 0 ? Math.round((profit / revenue) * 100) : 0;

  const resultColumns = buildResultColumns(t);

  const resultSummary = [
    { label: t("Doanh thu"),    value: revenue, color: "#1E70E6" },
    { label: t("Chi phí"),            value: expense, color: "#EF4444" },
    { label: t("Lợi nhuận"),          value: profit,  color: "#10B981" },
    { label: t("Tỷ lệ lợi nhuận"), value: `${margin}%`, color: "#F59E0B" },
  ];

  const resultData = [
    { category: t("Dịch vụ nha khoa"), revenue, expense: 0, profit: revenue, margin: revenue > 0 ? 100 : 0 },
  ];

  return (
    <>
      <Row gutter={[12, 12]} style={{ margin: "12px 0" }}>
        {resultSummary.map((c) => (
          <Col key={c.label} xs={24} sm={12} md={6}>
            <div className="reception-card" style={{ padding: "16px 20px" }}>
              <div style={{ fontSize: 12, color: "#5A6B82", marginBottom: 4 }}>{c.label}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: c.color, fontVariantNumeric: "tabular-nums" }}>
                {typeof c.value === "number" ? `${formatVND(c.value)} đ` : c.value}
              </div>
            </div>
          </Col>
        ))}
      </Row>

      <div className="reception-card reception-card--toolbar">
        <div style={{ display: "flex", alignItems: "center" }}>
          <Button icon={<DownloadOutlined />} style={{ marginLeft: "auto" }}>{t("Xuất Excel")}</Button>
        </div>
      </div>

      <div className="reception-card reception-card--content">
        <Table
          size="small"
          rowKey="category"
          columns={resultColumns}
          dataSource={resultData}
          pagination={false}
          locale={{ emptyText: t("Không có dữ liệu") }}
          summary={() => (
            <Table.Summary.Row>
              <Table.Summary.Cell index={0}><Text strong>{t("Tổng")}</Text></Table.Summary.Cell>
              <Table.Summary.Cell index={1} align="right"><Text strong style={{ fontVariantNumeric: "tabular-nums" }}>{formatVND(revenue)} đ</Text></Table.Summary.Cell>
              <Table.Summary.Cell index={2} align="right"><Text strong style={{ color: "#EF4444", fontVariantNumeric: "tabular-nums" }}>{formatVND(expense)} đ</Text></Table.Summary.Cell>
              <Table.Summary.Cell index={3} align="right"><Text strong style={{ color: "#10B981", fontVariantNumeric: "tabular-nums" }}>{formatVND(profit)} đ</Text></Table.Summary.Cell>
              <Table.Summary.Cell index={4} align="right"><Text strong>{margin}%</Text></Table.Summary.Cell>
            </Table.Summary.Row>
          )}
        />
      </div>
    </>
  );
}
