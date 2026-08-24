import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useStaffList } from "@/features/staff/api/staffQueries";
import { Download, Plus } from "lucide-react";
import dayjs, { type Dayjs } from "dayjs";
import { formatDate, formatVND } from "@/utils/format";
import { exportToExcel } from "@/utils/exportExcel";
import { useReportSummary, useRevenueReport, useExpenseReport } from "../api/reportingApi";
import { useCurrentBranchId } from "@/lib/clinicBranch";
import { useAuthStore } from "@/features/auth/store/authStore";
import { extractApiError } from "@/lib/apiError";
import { SalesEntryModal } from "../components/SalesEntryModal";
import { CashflowEntryModal } from "../components/CashflowEntryModal";
import { DateNavigator } from "@/components/DateNavigator";
import { SegmentedControl } from "@/components/ui/segmented-control";
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

// ── Generic simple table renderer ──────────────────────────────────────────

interface ColDef {
  title: string;
  key: string;
  dataIndex?: string;
  width?: number;
  align?: "left" | "right" | "center";
  render?: (value: unknown, row: Record<string, unknown>) => React.ReactNode;
}

function SimpleTable({ columns, dataSource, loading, emptyText, footer }: {
  columns: ColDef[];
  dataSource: Record<string, unknown>[];
  loading?: boolean;
  emptyText?: string;
  footer?: React.ReactNode;
}) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((col) => (
              <TableHead
                key={col.key}
                style={{ width: col.width, textAlign: col.align ?? "left" }}
              >
                {col.title}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell colSpan={columns.length} className="py-10 text-center">
                <Loader2 className="size-5 animate-spin mx-auto text-muted-foreground" />
              </TableCell>
            </TableRow>
          ) : dataSource.length === 0 ? (
            <TableRow>
              <TableCell colSpan={columns.length} className="py-10 text-center text-muted-foreground">
                {emptyText ?? t("Không có dữ liệu")}
              </TableCell>
            </TableRow>
          ) : (
            dataSource.map((row, i) => (
              <TableRow key={(row.id as string) ?? i}>
                {columns.map((col) => {
                  const value = col.dataIndex ? row[col.dataIndex] : undefined;
                  return (
                    <TableCell key={col.key} style={{ textAlign: col.align ?? "left" }}>
                      {col.render ? col.render(value, row) : String(value ?? "")}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))
          )}
          {footer}
        </TableBody>
      </Table>
    </div>
  );
}

function buildCashflowColumns(
  t: Translate,
  approvalConfig: Record<SalesApprovalStatus, { label: string; color: string } | null>,
  actions?: (row: SalesEntryDto) => React.ReactNode,
): ColDef[] {
  return [
    { title: t("Ngày"), key: "entryDate", dataIndex: "entryDate", width: 110, render: (v) => formatDate(v as string) },
    { title: t("Số phiếu"), key: "code", dataIndex: "code", width: 110 },
    { title: t("Loại"), key: "type", dataIndex: "type", width: 80,
      render: (v) => (
        <span className={`text-xs px-2 py-0.5 rounded font-medium ${v === SALES_ENTRY_TYPE.Income ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
          {v === SALES_ENTRY_TYPE.Income ? t("Thu") : t("Chi")}
        </span>
      ) },
    { title: t("Danh mục"), key: "categoryName", dataIndex: "categoryName", width: 160,
      render: (v) => (v as string | null) ?? "—" },
    { title: t("Nội dung"), key: "description", dataIndex: "description" },
    { title: t("Thành tiền"), key: "amount", dataIndex: "amount", width: 140, align: "right",
      render: (v, r) => (
        <span style={{
          color: (r as { type: SalesEntryType }).type === SALES_ENTRY_TYPE.Income ? "#10B981" : "#EF4444",
          fontVariantNumeric: "tabular-nums",
        }}>
          {(r as { type: SalesEntryType }).type === SALES_ENTRY_TYPE.Income ? "+" : "-"}{formatVND((v as number) ?? 0)} đ
        </span>
      ) },
    { title: t("Phương thức"), key: "channel", dataIndex: "channel", width: 130,
      render: (v) => PAYMENT_CHANNEL_LABELS[v as PaymentChannel] },
    { title: t("Người thực hiện"), key: "staffName", dataIndex: "staffName", width: 160,
      render: (v) => (v as string | null) ?? "—" },
    { title: t("Duyệt"), key: "approvalStatus", dataIndex: "approvalStatus", width: 110,
      render: (v) => {
        const config = approvalConfig[v as SalesApprovalStatus];
        return config ? (
          <span className={`text-xs px-2 py-0.5 rounded font-medium`} style={{ background: `${config.color}22`, color: config.color }}>{config.label}</span>
        ) : <span className="text-muted-foreground text-sm">—</span>;
      } },
    ...(actions
      ? [{ title: t("Thao tác"), key: "actions", width: 200, render: (_: unknown, row: Record<string, unknown>) => actions(row as unknown as SalesEntryDto) }]
      : []),
  ];
}

function buildResultColumns(t: Translate): ColDef[] {
  return [
    { title: t("Danh mục"), key: "category", dataIndex: "category" },
    { title: t("Doanh thu"), key: "revenue", dataIndex: "revenue", width: 160, align: "right",
      render: (v) => <span style={{ fontVariantNumeric: "tabular-nums" }}>{formatVND((v as number) ?? 0)} đ</span> },
    { title: t("Chi phí"), key: "expense", dataIndex: "expense", width: 160, align: "right",
      render: (v) => <span style={{ color: "#EF4444", fontVariantNumeric: "tabular-nums" }}>{formatVND((v as number) ?? 0)} đ</span> },
    { title: t("Lợi nhuận"), key: "profit", dataIndex: "profit", width: 160, align: "right",
      render: (v) => <span style={{ color: "#10B981", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{formatVND((v as number) ?? 0)} đ</span> },
    { title: t("Tỷ lệ LN (%)"), key: "margin", dataIndex: "margin", width: 120, align: "right",
      render: (v) => <span style={{ color: (v as number) >= 0 ? "#10B981" : "#EF4444" }}>{(v as number) ?? 0}%</span> },
  ];
}

function buildExpenseColumns(t: Translate): ColDef[] {
  return [
    { title: t("Ngày"), key: "date", dataIndex: "date", width: 110 },
    { title: t("Tên khách hàng"), key: "patientName", dataIndex: "patientName", width: 180 },
    { title: t("Nhân sự tư vấn"), key: "counselorName", dataIndex: "counselorName", width: 150 },
    { title: t("Bác sĩ tiếp nhận"), key: "doctorName", dataIndex: "doctorName", width: 150 },
    { title: t("Dịch vụ điều trị"), key: "serviceName", dataIndex: "serviceName" },
    { title: t("Số lượng"), key: "quantity", dataIndex: "quantity", width: 90, align: "right" },
    { title: t("Thành tiền"), key: "totalAmount", dataIndex: "totalAmount", width: 130, align: "right", render: (v) => <span style={{ fontVariantNumeric: "tabular-nums" }}>{formatVND((v as number) ?? 0)} đ</span> },
    { title: t("Đã thanh toán"), key: "paidAmount", dataIndex: "paidAmount", width: 130, align: "right", render: (v) => <span style={{ color: "#10B981", fontVariantNumeric: "tabular-nums" }}>{formatVND((v as number) ?? 0)} đ</span> },
  ];
}

function buildCashflowEntryColumns(t: Translate): ColDef[] {
  return [
    { title: t("Ngày"), key: "entryDate", dataIndex: "entryDate", width: 110, render: (v) => formatDate(v as string) },
    { title: t("Loại giao dịch"), key: "transactionType", dataIndex: "transactionType", width: 130,
      render: (v) => <span className="text-xs px-2 py-0.5 rounded bg-muted">{CASH_TRANSACTION_LABELS[v as CashTransactionType]}</span> },
    { title: t("Hình thức"), key: "holding", width: 200,
      render: (_, r) => {
        const from = (r as { fromHolding: CashHolding | null }).fromHolding ? CASH_HOLDING_LABELS[(r as { fromHolding: CashHolding }).fromHolding] : null;
        const to = (r as { toHolding: CashHolding | null }).toHolding ? CASH_HOLDING_LABELS[(r as { toHolding: CashHolding }).toHolding] : null;
        if (from && to) return `${from} → ${to}`;
        return to ?? from ?? "—";
      } },
    { title: t("Danh mục"), key: "categoryName", dataIndex: "categoryName", width: 160,
      render: (v) => (v as string | null) ?? "—" },
    { title: t("Thành tiền"), key: "amount", dataIndex: "amount", width: 140, align: "right",
      render: (v) => <span style={{ fontVariantNumeric: "tabular-nums" }}>{formatVND((v as number) ?? 0)} đ</span> },
    { title: t("Người tạo"), key: "createdByStaffName", dataIndex: "createdByStaffName", width: 160,
      render: (v) => (v as string | null) ?? "—" },
    { title: t("Ghi chú"), key: "note", dataIndex: "note", render: (v) => (v as string | null) ?? "—" },
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

  return (
    <div className="reception-page">
      <PageHeader
        title={t("Báo cáo")}
        subtitle={t("Kỳ báo cáo theo khoảng thời gian đã chọn")}
      />

      {/* Main tab bar */}
      <div className="reception-card" style={{ padding: "0 16px" }}>
        <div style={{ display: "flex", gap: 0 }}>
          {REPORT_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              style={{
                padding: "10px 16px", border: "none",
                borderBottom: activeTab === tab.key ? "2px solid #1677ff" : "2px solid transparent",
                background: "none",
                color: activeTab === tab.key ? "#1677ff" : "#595959",
                fontWeight: activeTab === tab.key ? 600 : 400,
                cursor: "pointer", fontSize: 14, whiteSpace: "nowrap",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Shared toolbar */}
      <div className="reception-card reception-card--toolbar">
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <SegmentedControl
            options={[
              { key: "day" as DateMode, label: t("Ngày") },
              { key: "week" as DateMode, label: t("Tuần") },
              { key: "month" as DateMode, label: t("Tháng") },
              { key: "year" as DateMode, label: t("Năm") },
            ]}
            value={dateMode}
            onChange={setDateMode}
          />
          <DateNavigator
            value={currentDate}
            mode={dateMode}
            onChange={(d) => setCurrentDate(() => d)}
          />
          <Select>
            <SelectTrigger className="min-w-44">
              <SelectValue placeholder={t("Bác sĩ điều trị")} />
            </SelectTrigger>
            <SelectContent>
              {doctorOptions.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
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
              {expenseLoading ? <Loader2 className="size-4 animate-spin" /> : (
                <span style={{ fontWeight: 700, fontSize: 18, color: "#1B2A41" }}>
                  {formatVND(expenseData?.grandTotalAmount ?? 0)} đ
                </span>
              )}
              <Button variant="outline" className="ml-auto" onClick={handleExportRevenue}>
                <Download size={14} className="mr-1.5" />
                {t("Xuất Excel")}
              </Button>
            </div>
          </div>

          {/* Table */}
          <div className="reception-card reception-card--content">
            <SimpleTable
              columns={expenseColumns}
              dataSource={(expenseData?.items ?? []) as Record<string, unknown>[]}
              loading={expenseLoading}
              emptyText={t("Không có dữ liệu")}
            />
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            <div className="reception-card" style={{ padding: 16 }}>
              <div style={{ fontWeight: 600, fontSize: 13, color: "#1B2A41", marginBottom: 10 }}>{t("Thông tin lượt khách")}</div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                <span style={{ color: "#5A6B82" }}>{t("Lượt khách")}</span>
                <span style={{ fontWeight: 600 }}>{expenseLoading ? "…" : (expenseData?.totalCount ?? 0)} {t("lượt")}</span>
              </div>
            </div>
            <div className="reception-card" style={{ padding: 16 }}>
              <div style={{ fontWeight: 600, fontSize: 13, color: "#1B2A41", marginBottom: 10 }}>{t("Thông tin lịch hẹn")}</div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                <span style={{ color: "#5A6B82" }}>{t("Lịch hẹn khách hàng")}</span>
                <span style={{ fontWeight: 600 }}>{summaryLoading ? "…" : (summary?.totalAppointments ?? 0)}</span>
              </div>
            </div>
            <div className="reception-card" style={{ padding: 16 }}>
              <div style={{ fontWeight: 600, fontSize: 13, color: "#1B2A41", marginBottom: 10 }}>{t("Thông tin thanh toán")}</div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                <span style={{ color: "#5A6B82" }}>{t("Doanh thu")}</span>
                <span style={{ fontWeight: 600, color: "#10B981" }}>
                  {expenseLoading ? "…" : formatVND(expenseData?.grandTotalAmount ?? 0)} đ
                </span>
              </div>
            </div>
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
          </div>
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
    [SALES_APPROVAL_STATUS.Pending]:  { label: t("Chờ duyệt"),  color: "goldenrod" },
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
  const [rejectRow, setRejectRow] = useState<SalesEntryDto | null>(null);
  const [rejectReason, setRejectReason] = useState("");

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
      toast.success(t("Đã duyệt"));
    } catch (error) {
      toast.error(extractApiError(error));
    }
  };

  const handleRejectConfirm = async () => {
    if (!rejectRow || !currentUserId) return;
    if (!rejectReason.trim()) {
      toast.error(t("Vui lòng nhập lý do từ chối."));
      return;
    }
    try {
      await rejectEntry.mutateAsync({ id: rejectRow.id, staffId: currentUserId, reason: rejectReason.trim() });
      toast.success(t("Từ chối"));
      setRejectRow(null);
      setRejectReason("");
    } catch (error) {
      toast.error(extractApiError(error));
    }
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
    <div className="flex items-center gap-1 flex-wrap">
      {row.approvalStatus === SALES_APPROVAL_STATUS.Pending && (
        <>
          <Button variant="ghost" size="sm" className="h-7 text-xs text-blue-600 hover:text-blue-700" onClick={() => handleApprove(row)}>{t("Duyệt")}</Button>
          <AlertDialog open={rejectRow?.id === row.id} onOpenChange={(open) => { if (!open) { setRejectRow(null); setRejectReason(""); } }}>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive hover:text-destructive" onClick={() => setRejectRow(row)}>{t("Từ chối")}</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t("Từ chối phiếu {0}", row.code)}</AlertDialogTitle>
                <AlertDialogDescription>
                  <textarea
                    rows={3}
                    placeholder={t("Lý do từ chối")}
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t("Hủy")}</AlertDialogCancel>
                <AlertDialogAction onClick={handleRejectConfirm}>{t("Từ chối")}</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}
      {row.approvalStatus !== SALES_APPROVAL_STATUS.Approved && (
        <>
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => { setEditing(row); setModalOpen(true); }}>
            {t("Chỉnh sửa")}
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive hover:text-destructive">{t("Xóa")}</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t("Xoá phiếu này?")}</AlertDialogTitle>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t("Hủy")}</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive hover:bg-destructive/90"
                  onClick={async () => {
                    try {
                      await deleteEntry.mutateAsync(row.id);
                      toast.success(t("Xóa thành công"));
                    } catch (error) {
                      toast.error(extractApiError(error));
                    }
                  }}
                >
                  {t("Xóa")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}
    </div>
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

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 my-3">
        {summaryCards.map((c) => (
          <div key={c.label} className="reception-card" style={{ padding: "16px 20px" }}>
            <div style={{ fontSize: 12, color: "#5A6B82", marginBottom: 4 }}>{c.label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: c.color, fontVariantNumeric: "tabular-nums" }}>
              {formatVND(c.value)} đ
            </div>
          </div>
        ))}
      </div>

      {(stats?.pendingExpenseCount ?? 0) > 0 && (
        <div className="reception-card" style={{ padding: "10px 16px", marginBottom: 12 }}>
          <span style={{ fontSize: 13, color: "#B45309" }}>
            {t("{0} phiếu chi đang chờ duyệt ({1} đ) — chưa được tính vào tổng chi.", stats?.pendingExpenseCount ?? 0, formatVND(stats?.pendingExpense ?? 0))}
          </span>
        </div>
      )}

      <div className="reception-card reception-card--toolbar">
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Button onClick={() => { setEditing(null); setModalOpen(true); }}>
            <Plus size={14} className="mr-1.5" />
            {t("Thêm mới")}
          </Button>
          <Button variant="outline" className="ml-auto">
            <Download size={14} className="mr-1.5" />
            {t("Xuất Excel")}
          </Button>
        </div>
      </div>

      <div className="reception-card reception-card--content">
        <SimpleTable
          columns={columns}
          dataSource={(page?.items ?? []) as Record<string, unknown>[]}
          loading={isLoading}
          emptyText={t("Không có dữ liệu")}
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
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 my-3">
        {balancePanels.map((panel) => (
          <div key={panel.label} className="reception-card" style={{ padding: "16px 20px" }}>
            <div style={{ fontSize: 12, color: "#5A6B82", marginBottom: 4 }}>{panel.label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: panel.color, fontVariantNumeric: "tabular-nums" }}>
              {formatVND(panel.value)} đ
            </div>
          </div>
        ))}
      </div>

      <div className="reception-card reception-card--toolbar">
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <Button onClick={() => setCashModal(CASH_TRANSACTION_TYPE.Deposit)}>
            {t("Nạp")}
          </Button>
          <Button variant="outline" onClick={() => setCashModal(CASH_TRANSACTION_TYPE.Withdraw)}>
            {t("Rút")}
          </Button>
          <Button variant="outline" onClick={() => setCashModal(CASH_TRANSACTION_TYPE.Transfer)}>
            {t("Luân chuyển")}
          </Button>
          <span style={{ fontSize: 13, color: "#5A6B82", marginLeft: 12 }}>
            {t("Nạp")}: {formatVND(overview?.totalDeposit ?? 0)} đ
            {" · "}
            {t("Rút")}: {formatVND(overview?.totalWithdraw ?? 0)} đ
            {" · "}
            {t("Luân chuyển")}: {formatVND(overview?.totalTransfer ?? 0)} đ
          </span>
          <Button variant="outline" className="ml-auto">
            <Download size={14} className="mr-1.5" />
            {t("Xuất Excel")}
          </Button>
        </div>
      </div>

      <div className="reception-card reception-card--content">
        <SimpleTable
          columns={cashflowEntryColumns}
          dataSource={(page?.items ?? []) as Record<string, unknown>[]}
          loading={isLoading}
          emptyText={t("Không có dữ liệu")}
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
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 my-3">
        {resultSummary.map((c) => (
          <div key={c.label} className="reception-card" style={{ padding: "16px 20px" }}>
            <div style={{ fontSize: 12, color: "#5A6B82", marginBottom: 4 }}>{c.label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: c.color, fontVariantNumeric: "tabular-nums" }}>
              {typeof c.value === "number" ? `${formatVND(c.value)} đ` : c.value}
            </div>
          </div>
        ))}
      </div>

      <div className="reception-card reception-card--toolbar">
        <div style={{ display: "flex", alignItems: "center" }}>
          <Button variant="outline" className="ml-auto">
            <Download size={14} className="mr-1.5" />
            {t("Xuất Excel")}
          </Button>
        </div>
      </div>

      <div className="reception-card reception-card--content">
        <SimpleTable
          columns={resultColumns}
          dataSource={resultData as Record<string, unknown>[]}
          emptyText={t("Không có dữ liệu")}
          footer={
            <TableRow className="font-bold bg-muted/50">
              <TableCell>{t("Tổng")}</TableCell>
              <TableCell className="text-right" style={{ fontVariantNumeric: "tabular-nums" }}>{formatVND(revenue)} đ</TableCell>
              <TableCell className="text-right" style={{ color: "#EF4444", fontVariantNumeric: "tabular-nums" }}>{formatVND(expense)} đ</TableCell>
              <TableCell className="text-right" style={{ color: "#10B981", fontVariantNumeric: "tabular-nums" }}>{formatVND(profit)} đ</TableCell>
              <TableCell className="text-right">{margin}%</TableCell>
            </TableRow>
          }
        />
      </div>
    </>
  );
}
