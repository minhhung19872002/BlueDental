import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Tabs, Row, Col, Button, Select, Segmented, Table, Typography, Tag, Modal, Input, Popconfirm, message } from "antd";
import { DownloadOutlined, LeftOutlined, RightOutlined, PlusOutlined } from "@ant-design/icons";
import dayjs, { type Dayjs } from "dayjs";
import { formatDate, formatVND } from "@/utils/format";
import { useCurrentBranchId } from "@/lib/clinicBranch";
import { downloadFile } from "@/lib/download";
import {
  useBusinessResult,
  usePatientHistory,
  usePaymentStat,
} from "../api/clinicReportApi";
import type { PatientHistoryRowDto } from "../api/clinicReportApi";
import { useAuthStore } from "@/features/auth/store/authStore";
import { extractApiError } from "@/lib/apiError";
import { SalesEntryModal } from "../components/SalesEntryModal";
import { CashflowEntryModal } from "../components/CashflowEntryModal";
import {
  cashHoldingLabels,
  cashTransactionLabels,
  CASH_TRANSACTION_TYPE,
  paymentChannelLabels,
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
import { t } from "@/lib/i18n";

const { Text } = Typography;

type DateMode = "day" | "week" | "month" | "year";

const reportTabs = () => [
  { key: "expense",    label: t("Doanh số và lượt khách") },
  { key: "cashflow",   label: t("Quản lý thu chi") },
  { key: "result",     label: t("Kết quả kinh doanh") },
  { key: "cashflow-v2",label: t("Luân chuyển dòng tiền V2") },
];

const subFilters = () => [
  { key: "service",  label: t("Khách hàng phát sinh dịch vụ") },
  { key: "payment",  label: t("Thanh toán") },
  { key: "refund",   label: t("Hoàn tiền") },
  { key: "debt",     label: t("Dư nợ") },
];

const cashflowTypes = () => [
  { key: "all", label: t("Tất cả") },
  { key: "thu", label: "Thu" },
  { key: "chi", label: "Chi" },
];

function buildCashflowColumns(actions: (row: SalesEntryDto) => React.ReactNode) {
  return [
  { title: t("Ngày"), dataIndex: "entryDate", key: "entryDate", width: 110, render: (v: string) => formatDate(v) },
  { title: t("Số phiếu"), dataIndex: "code", key: "code", width: 110 },
  { title: t("Loại"), dataIndex: "type", key: "type", width: 80,
    render: (v: SalesEntryType) => (
      <Tag color={v === SALES_ENTRY_TYPE.Income ? "green" : "red"}>
        {v === SALES_ENTRY_TYPE.Income ? "Thu" : "Chi"}
      </Tag>
    ) },
  { title: t("Danh mục"), dataIndex: "categoryName", key: "categoryName", width: 160,
    render: (v: string | null) => v ?? "—" },
  { title: t("Nội dung"), dataIndex: "description", key: "description" },
  { title: t("Số tiền"), dataIndex: "amount", key: "amount", width: 140, align: "right" as const,
    render: (v: number, r: { type: SalesEntryType }) => (
      <Text style={{
        color: r.type === SALES_ENTRY_TYPE.Income ? "#1f8a63" : "#ef4d4d",
        fontVariantNumeric: "tabular-nums",
      }}>
        {r.type === SALES_ENTRY_TYPE.Income ? "+" : "-"}{formatVND(v ?? 0)} {t("đ")}
      </Text>
    ) },
  { title: t("Phương thức"), dataIndex: "channel", key: "channel", width: 130,
    render: (v: PaymentChannel) => paymentChannelLabels()[v] },
  { title: t("Người thực hiện"), dataIndex: "staffName", key: "staffName", width: 160,
    render: (v: string | null) => v ?? "—" },
  { title: t("Duyệt"), dataIndex: "approvalStatus", key: "approvalStatus", width: 110,
    render: (v: SalesApprovalStatus) => {
      const config = approvalConfig()[v];
      return config ? <Tag color={config.color}>{config.label}</Tag> : <Text type="secondary">—</Text>;
    } },
  { title: t("Thao tác"), key: "actions", width: 200, render: (_: unknown, row: SalesEntryDto) => actions(row) },
  ];
}

interface PeriodRange {
  fromDate: string;
  toDate: string;
}

/** The toolbar's Ngày/Tuần/Tháng/Năm switch resolved into an inclusive range. */
function resolvePeriod(currentDate: Dayjs, dateMode: DateMode): PeriodRange {
  const unit = dateMode === "day" ? "day" : dateMode === "week" ? "week" : dateMode === "month" ? "month" : "year";
  return {
    fromDate: currentDate.startOf(unit).format("YYYY-MM-DD"),
    toDate: currentDate.endOf(unit).format("YYYY-MM-DD"),
  };
}

export function ReportPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  const activeTab = searchParams.get("tab") ?? "expense";
  const dateMode = (searchParams.get("dateMode") as DateMode) ?? "day";
  const currentDate = dayjs(searchParams.get("date") ?? undefined);
  const [subFilter, setSubFilter] = useState("service");
  const period = resolvePeriod(currentDate, dateMode);

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

  const displayDate = () => {
    if (dateMode === "day") return currentDate.format("DD/MM/YYYY");
    if (dateMode === "week") return `${currentDate.startOf("week").format("DD/MM")} – ${currentDate.endOf("week").format("DD/MM/YYYY")}`;
    if (dateMode === "month") return currentDate.format("MM/YYYY");
    return currentDate.format("YYYY");
  };

  return (
    <div className="reception-page">
      {/* Main tab bar */}
      <div className="reception-card" style={{ padding: "0 16px" }}>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          style={{ marginBottom: 0 }}
          items={reportTabs().map((tab) => ({ key: tab.key, label: tab.label }))}
        />
      </div>

      {/* Shared toolbar */}
      <div className="reception-card reception-card--toolbar">
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <Segmented
            value={dateMode}
            onChange={(v) => setDateMode(v as DateMode)}
            options={[
              { label: t("Ngày"),  value: "day" },
              { label: t("Tuần"),  value: "week" },
              { label: t("Tháng"), value: "month" },
              { label: t("Năm"),   value: "year" },
            ]}
          />
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <Button type="text" size="small" icon={<LeftOutlined />} onClick={() => navigateDate(-1)} />
            <span style={{ minWidth: 130, textAlign: "center", fontWeight: 600, fontSize: 14 }}>{displayDate()}</span>
            <Button type="text" size="small" icon={<RightOutlined />} onClick={() => navigateDate(1)} />
          </div>
          <Select placeholder={t("Bác sĩ điều trị")} allowClear style={{ minWidth: 180 }} options={[]} />
        </div>
      </div>

      {/* Tab content */}
      {activeTab === "expense" && (
        <SalesTab period={period} subFilter={subFilter} onSubFilterChange={setSubFilter} />
      )}
      {activeTab === "cashflow" && <CashflowTab period={period} />}
      {activeTab === "result" && <BusinessResultTab period={period} />}
      {activeTab === "cashflow-v2" && <CashflowV2Tab period={period} />}
    </div>
  );
}

const approvalConfig = (): Record<SalesApprovalStatus, { label: string; color: string } | null> => ({
  [SALES_APPROVAL_STATUS.NotRequired]: null,
  [SALES_APPROVAL_STATUS.Pending]: { label: t("Chờ duyệt"), color: "gold" },
  [SALES_APPROVAL_STATUS.Approved]: { label: t("Đã duyệt"), color: "green" },
  [SALES_APPROVAL_STATUS.Rejected]: { label: t("Từ chối"), color: "red" },
});

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
      message.success(t("Đã duyệt phiếu chi"));
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
      cancelText: t("Huỷ"),
      onOk: async () => {
        if (!reason.trim()) {
          message.error(t("Vui lòng nhập lý do từ chối."));
          throw new Error("missing reason");
        }
        try {
          await rejectEntry.mutateAsync({ id: row.id, staffId: currentUserId, reason: reason.trim() });
          message.success(t("Đã từ chối phiếu chi"));
        } catch (error) {
          message.error(extractApiError(error));
          throw error;
        }
      },
    });
  };

  const columns = buildCashflowColumns((row) => (
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
            {t("Sửa")}
          </Button>
          <Popconfirm
            title={t("Xoá phiếu này?")}
            okText={t("Xoá")}
            cancelText={t("Huỷ")}
            onConfirm={async () => {
              try {
                await deleteEntry.mutateAsync(row.id);
                message.success(t("Đã xoá phiếu"));
              } catch (error) {
                message.error(extractApiError(error));
              }
            }}
          >
            <Button type="link" size="small" danger>{t("Xoá")}</Button>
          </Popconfirm>
        </>
      )}
    </>
  ));

  const summaryCards = [
    { label: t("Tổng thu"), value: stats?.totalIncome ?? 0, color: "#1f8a63" },
    { label: t("Tổng chi"), value: stats?.totalExpense ?? 0, color: "#ef4d4d" },
    { label: t("Lợi nhuận ước tính"), value: stats?.net ?? 0, color: "#1c3566" },
  ];

  return (
    <>
      <div className="reception-card reception-card--tabs">
        <div style={{ display: "flex", gap: 0 }}>
          {cashflowTypes().map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setTypeFilter(f.key)}
              style={{
                padding: "8px 14px", border: "none",
                borderBottom: typeFilter === f.key ? "2px solid #1c3566" : "2px solid transparent",
                background: "none",
                color: typeFilter === f.key ? "#1c3566" : "#6f7c90",
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
              <div style={{ fontSize: 12, color: "#6f7c90", marginBottom: 4 }}>{c.label}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: c.color, fontVariantNumeric: "tabular-nums" }}>
                {formatVND(c.value)} {t("đ")}
              </div>
            </div>
          </Col>
        ))}
      </Row>

      {(stats?.pendingExpenseCount ?? 0) > 0 && (
        <div className="reception-card" style={{ padding: "10px 16px", marginBottom: 12 }}>
          <Text style={{ fontSize: 13, color: "#B45309" }}>
            {stats?.pendingExpenseCount} {t("phiếu chi đang chờ duyệt (")}{formatVND(stats?.pendingExpense ?? 0)} {t("đ) — chưa được tính vào tổng chi.")}
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

const cashflowEntryColumns = () => [
  { title: t("Ngày"), dataIndex: "entryDate", key: "entryDate", width: 110, render: (v: string) => formatDate(v) },
  { title: t("Loại giao dịch"), dataIndex: "transactionType", key: "transactionType", width: 130,
    render: (v: CashTransactionType) => <Tag>{cashTransactionLabels()[v]}</Tag> },
  { title: t("Hình thức"), key: "holding", width: 200,
    render: (_: unknown, r: { fromHolding: CashHolding | null; toHolding: CashHolding | null }) => {
      const from = r.fromHolding ? cashHoldingLabels()[r.fromHolding] : null;
      const to = r.toHolding ? cashHoldingLabels()[r.toHolding] : null;
      if (from && to) return `${from} → ${to}`;
      return to ?? from ?? "—";
    } },
  { title: t("Danh mục"), dataIndex: "categoryName", key: "categoryName", width: 160,
    render: (v: string | null) => v ?? "—" },
  { title: t("Số tiền"), dataIndex: "amount", key: "amount", width: 140, align: "right" as const,
    render: (v: number) => <Text style={{ fontVariantNumeric: "tabular-nums" }}>{formatVND(v ?? 0)} {t("đ")}</Text> },
  { title: t("Người tạo"), dataIndex: "createdByStaffName", key: "createdByStaffName", width: 160,
    render: (v: string | null) => v ?? "—" },
  { title: t("Ghi chú"), dataIndex: "note", key: "note", render: (v: string | null) => v ?? "—" },
];

function CashflowV2Tab({ period }: { period: PeriodRange }) {
  const branchId = useCurrentBranchId();
  const params = { clinicBranchId: branchId, ...period };
  const [cashModal, setCashModal] = useState<CashTransactionType | null>(null);

  const { data: overview } = useCashflowOverview(params);
  const { data: page, isLoading } = useCashflowEntries({ ...params, maxResultCount: 100 });

  // Panel order and wording follow the reference "Luân chuyển dòng tiền V2" tab.
  const balancePanels = [
    { label: t("Tổng Tiền"), value: overview?.balance.total ?? 0, color: "#101c2c" },
    { label: t("Tổng Tiền Mặt"), value: overview?.balance.cash ?? 0, color: "#1f8a63" },
    { label: t("Tổng Chuyển Khoản"), value: overview?.balance.bank ?? 0, color: "#1c3566" },
    { label: t("Đang Giữ Hộ Khách"), value: overview?.balance.customerPrepaid ?? 0, color: "#dd9426" },
  ];

  return (
    <>
      <Row gutter={[12, 12]} style={{ margin: "12px 0" }}>
        {balancePanels.map((panel) => (
          <Col key={panel.label} xs={24} sm={12} md={6}>
            <div className="reception-card" style={{ padding: "16px 20px" }}>
              <div style={{ fontSize: 12, color: "#6f7c90", marginBottom: 4 }}>{panel.label}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: panel.color, fontVariantNumeric: "tabular-nums" }}>
                {formatVND(panel.value)} {t("đ")}
              </div>
            </div>
          </Col>
        ))}
      </Row>

      <div className="reception-card reception-card--toolbar">
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <Button type="primary" onClick={() => setCashModal(CASH_TRANSACTION_TYPE.Deposit)}>{t("Nạp")}</Button>
          <Button onClick={() => setCashModal(CASH_TRANSACTION_TYPE.Withdraw)}>{t("Rút")}</Button>
          <Button onClick={() => setCashModal(CASH_TRANSACTION_TYPE.Transfer)}>{t("Luân chuyển")}</Button>
          <Text style={{ fontSize: 13, color: "#6f7c90", marginLeft: 12 }}>
            {t("Nạp:")} {formatVND(overview?.totalDeposit ?? 0)} {t("đ · Rút:")} {formatVND(overview?.totalWithdraw ?? 0)} {t("đ · Luân chuyển:")} {formatVND(overview?.totalTransfer ?? 0)} {t("đ")}
          </Text>
          <Button icon={<DownloadOutlined />} style={{ marginLeft: "auto" }}>{t("Xuất Excel")}</Button>
        </div>
      </div>

      <div className="reception-card reception-card--content">
        <Table
          size="small"
          rowKey="id"
          loading={isLoading}
          columns={cashflowEntryColumns()}
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

/**
 * Doanh số và lượt khách.
 *
 * Every figure comes from the server; the browser only formats. The sub-filters
 * narrow the same ledger the reference shows.
 */
function SalesTab({
  period,
  subFilter,
  onSubFilterChange,
}: {
  period: PeriodRange;
  subFilter: string;
  onSubFilterChange: (key: string) => void;
}) {
  const branchId = useCurrentBranchId();
  const query = { clinicBranchId: branchId, ...period };

  const { data: stat } = usePaymentStat(query);
  const { data: history, isLoading } = usePatientHistory(query);

  const rows = (history ?? []).filter((row) => {
    if (subFilter === "payment") return row.totalPaid > 0;
    if (subFilter === "debt") return row.effectiveAmount > row.totalPaid;
    if (subFilter === "refund") return false; // refunds are not per-slip rows yet
    return true;
  });

  const cards = [
    {
      title: t("Thông tin lượt khách"),
      testId: "sales-visits",
      metrics: [{ label: t("Lượt khách"), value: stat?.patientVisits ?? 0, unit: t("lượt khách") }],
    },
    {
      title: t("Thông tin thanh toán"),
      testId: "sales-paid",
      metrics: [
        { label: t("Đã thu"), value: stat?.totalPaid ?? 0, unit: t("đ") },
        { label: t("Hoàn tiền"), value: stat?.totalRefund ?? 0, unit: t("đ") },
      ],
    },
    {
      title: t("Hình thức thanh toán"),
      testId: "sales-methods",
      metrics: [
        { label: t("Tiền mặt"), value: stat?.byCash ?? 0, unit: t("đ") },
        { label: t("Chuyển khoản"), value: stat?.byBanking ?? 0, unit: t("đ") },
        { label: t("Quẹt thẻ"), value: stat?.byCard ?? 0, unit: t("đ") },
      ],
    },
    {
      title: t("Thông tin thu chi"),
      testId: "sales-cashflow",
      metrics: [
        { label: t("Thu khác"), value: stat?.totalIncome ?? 0, unit: t("đ") },
        { label: "Chi", value: stat?.totalExpense ?? 0, unit: t("đ") },
      ],
    },
  ];

  return (
    <>
      <div className="reception-card reception-card--tabs">
        <div style={{ display: "flex", gap: 0 }}>
          {subFilters().map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => onSubFilterChange(f.key)}
              style={{
                padding: "8px 14px",
                border: "none",
                borderBottom: subFilter === f.key ? "2px solid #1c3566" : "2px solid transparent",
                background: "none",
                color: subFilter === f.key ? "#1c3566" : "#6f7c90",
                fontWeight: subFilter === f.key ? 600 : 400,
                cursor: "pointer",
                fontSize: 13,
                whiteSpace: "nowrap",
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="reception-card reception-card--toolbar">
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <span style={{ fontSize: 13, color: "#6f7c90" }}>{t("Doanh số:")}</span>
          <span
            style={{ fontWeight: 700, fontSize: 18, color: "#101c2c" }}
            data-testid="sales-total"
          >
            {formatVND(stat?.totalActualReceived ?? 0)} {t("đ")}
          </span>
          <Button
            icon={<DownloadOutlined />}
            style={{ marginLeft: "auto" }}
            onClick={() =>
              void downloadFile(
                "/v1/app/clinic-reports/patient-history/excel",
                "doanh-so.xlsx",
                query,
              )
            }
          >
            {t("Xuất Excel")}
          </Button>
        </div>
      </div>

      <div className="reception-card reception-card--content">
        <Table<PatientHistoryRowDto>
          size="small"
          rowKey={(row) => `${row.patientId}-${row.date}`}
          loading={isLoading}
          columns={[
            { title: t("Ngày"), dataIndex: "date", key: "date", width: 110, render: (v: string) => formatDate(v) },
            { title: t("Tên khách hàng"), dataIndex: "patientName", key: "patientName", width: 200 },
            { title: t("Bác sĩ tiếp nhận"), dataIndex: "staffName", key: "staffName", width: 160, render: (v: string | null) => v ?? "—" },
            { title: t("Dịch vụ điều trị"), dataIndex: "serviceNames", key: "serviceNames" },
            { title: t("Số lượng"), dataIndex: "quantity", key: "quantity", width: 90, align: "right" as const },
            { title: t("Thành tiền"), dataIndex: "effectiveAmount", key: "effectiveAmount", width: 130, align: "right" as const, render: (v: number) => <Text style={{ fontVariantNumeric: "tabular-nums" }}>{formatVND(v)} {t("đ")}</Text> },
            { title: t("Đã thanh toán"), dataIndex: "totalPaid", key: "totalPaid", width: 130, align: "right" as const, render: (v: number) => <Text style={{ color: "#1f8a63", fontVariantNumeric: "tabular-nums" }}>{formatVND(v)} {t("đ")}</Text> },
          ]}
          dataSource={rows}
          pagination={{ pageSize: 20, showSizeChanger: true }}
          locale={{ emptyText: t("Không có dữ liệu") }}
        />
      </div>

      <Row gutter={[12, 12]}>
        {cards.map((card) => (
          <Col key={card.title} xs={24} sm={12} md={6}>
            <div className="reception-card" style={{ padding: 16 }} data-testid={card.testId}>
              <div style={{ fontWeight: 600, fontSize: 13, color: "#101c2c", marginBottom: 10 }}>
                {card.title}
              </div>
              {card.metrics.map((m) => (
                <div
                  key={m.label}
                  style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}
                >
                  <span style={{ color: "#6f7c90" }}>{m.label}</span>
                  <span style={{ fontWeight: 600, color: "#101c2c" }}>
                    {m.value.toLocaleString("vi-VN")} {m.unit}
                  </span>
                </div>
              ))}
            </div>
          </Col>
        ))}
      </Row>
    </>
  );
}

function BusinessResultTab({ period }: { period: PeriodRange }) {
  const branchId = useCurrentBranchId();
  const { data: result } = useBusinessResult({ clinicBranchId: branchId, ...period });

  const revenue = result?.totalRevenue ?? 0;
  const expense = result?.expense ?? 0;
  const profit = result?.result ?? 0;
  const margin = revenue === 0 ? 0 : Math.round((profit / revenue) * 100);

  const resultSummary = [
    { label: "Doanh thu", value: revenue, color: "#1c3566", testId: "result-revenue" },
    { label: t("Chi phí"), value: expense, color: "#ef4d4d", testId: "result-expense" },
    { label: t("Lợi nhuận"), value: profit, color: "#1f8a63", testId: "result-profit" },
    { label: t("Tỷ lệ lợi nhuận"), value: `${margin}%`, color: "#dd9426", testId: "result-margin" },
  ];

  /** The six rows the reference shows on result-stat/summary. */
  const rows = [
    { category: t("Doanh thu tổng"), amount: revenue },
    { category: t("Thu từ dịch vụ điều trị"), amount: result?.treatmentIncome ?? 0 },
    { category: t("Thu khác"), amount: result?.otherIncome ?? 0 },
    { category: t("Hoàn tiền từ dịch vụ điều trị"), amount: -(result?.treatmentRefund ?? 0) },
    { category: t("Chi phí"), amount: -expense },
    { category: t("Kết quả kinh doanh"), amount: profit },
  ];

  return (
    <>
      <Row gutter={[12, 12]} style={{ margin: "12px 0" }}>
        {resultSummary.map((c) => (
          <Col key={c.label} xs={24} sm={12} md={6}>
            <div className="reception-card" style={{ padding: "16px 20px" }} data-testid={c.testId}>
              <div style={{ fontSize: 12, color: "#6f7c90", marginBottom: 4 }}>{c.label}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: c.color, fontVariantNumeric: "tabular-nums" }}>
                {typeof c.value === "number" ? t("{0} đ", formatVND(c.value)) : c.value}
              </div>
            </div>
          </Col>
        ))}
      </Row>

      <div className="reception-card reception-card--toolbar">
        <div style={{ display: "flex", alignItems: "center" }}>
          <Button
            icon={<DownloadOutlined />}
            style={{ marginLeft: "auto" }}
            onClick={() =>
              void downloadFile(
                "/v1/app/clinic-reports/business-result/excel",
                "ket-qua-kinh-doanh.xlsx",
                { clinicBranchId: branchId, ...period },
              )
            }
          >
            {t("Xuất Excel")}
          </Button>
        </div>
      </div>

      <div className="reception-card reception-card--content">
        <Table
          size="small"
          rowKey="category"
          columns={[
            { title: t("Khoản mục"), dataIndex: "category", key: "category" },
            {
              title: t("Số tiền"),
              dataIndex: "amount",
              key: "amount",
              width: 200,
              align: "right" as const,
              render: (value: number) => (
                <Text
                  strong={Math.abs(value) === Math.abs(profit)}
                  style={{
                    color: value < 0 ? "#ef4d4d" : "#101c2c",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {formatVND(value)} {t("đ")}
                </Text>
              ),
            },
          ]}
          dataSource={rows}
          pagination={false}
          locale={{ emptyText: t("Không có dữ liệu") }}
        />
      </div>
    </>
  );
}
