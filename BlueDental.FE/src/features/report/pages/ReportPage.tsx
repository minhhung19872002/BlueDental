import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Tabs, Row, Col, Button, Select, Segmented, Table, Typography, Tag, Modal, Input, Popconfirm, message } from "antd";
import { DownloadOutlined, LeftOutlined, RightOutlined, PlusOutlined } from "@ant-design/icons";
import dayjs, { type Dayjs } from "dayjs";
import { formatDate, formatVND } from "@/utils/format";
import { useCurrentBranchId } from "@/lib/clinicBranch";
import { useAuthStore } from "@/features/auth/store/authStore";
import { extractApiError } from "@/lib/apiError";
import { SalesEntryModal } from "../components/SalesEntryModal";
import { CashflowEntryModal } from "../components/CashflowEntryModal";
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

const REPORT_TABS = [
  { key: "expense",    label: "Doanh số và lượt khách" },
  { key: "cashflow",   label: "Quản lý thu chi" },
  { key: "result",     label: "Kết quả kinh doanh" },
  { key: "cashflow-v2",label: "Luân chuyển dòng tiền V2" },
];

const SUB_FILTERS = [
  { key: "service",  label: "Khách hàng phát sinh dịch vụ" },
  { key: "payment",  label: "Thanh toán" },
  { key: "refund",   label: "Hoàn tiền" },
  { key: "debt",     label: "Dư nợ" },
];

const SUMMARY_CARDS = [
  { title: "Thông tin lượt khách",  metrics: [{ label: "Lượt khách hôm nay", value: 0, unit: "lượt khách" }] },
  { title: "Thông tin lịch hẹn",    metrics: [{ label: "Lịch hẹn hôm nay",   value: 0, unit: "lịch hẹn" }] },
  { title: "Thông tin thanh toán",  metrics: [{ label: "Doanh thu hôm nay",   value: 0, unit: "đ" }] },
  { title: "Thông tin thu chi",     metrics: [{ label: "Thu",                 value: 0, unit: "đ" }, { label: "Chi", value: 0, unit: "đ" }] },
];

const CASHFLOW_TYPES = [
  { key: "all", label: "Tất cả" },
  { key: "thu", label: "Thu" },
  { key: "chi", label: "Chi" },
];

function buildCashflowColumns(actions: (row: SalesEntryDto) => React.ReactNode) {
  return [
  { title: "Ngày", dataIndex: "entryDate", key: "entryDate", width: 110, render: (v: string) => formatDate(v) },
  { title: "Số phiếu", dataIndex: "code", key: "code", width: 110 },
  { title: "Loại", dataIndex: "type", key: "type", width: 80,
    render: (v: SalesEntryType) => (
      <Tag color={v === SALES_ENTRY_TYPE.Income ? "green" : "red"}>
        {v === SALES_ENTRY_TYPE.Income ? "Thu" : "Chi"}
      </Tag>
    ) },
  { title: "Danh mục", dataIndex: "categoryName", key: "categoryName", width: 160,
    render: (v: string | null) => v ?? "—" },
  { title: "Nội dung", dataIndex: "description", key: "description" },
  { title: "Số tiền", dataIndex: "amount", key: "amount", width: 140, align: "right" as const,
    render: (v: number, r: { type: SalesEntryType }) => (
      <Text style={{
        color: r.type === SALES_ENTRY_TYPE.Income ? "#10B981" : "#EF4444",
        fontVariantNumeric: "tabular-nums",
      }}>
        {r.type === SALES_ENTRY_TYPE.Income ? "+" : "-"}{formatVND(v ?? 0)} đ
      </Text>
    ) },
  { title: "Phương thức", dataIndex: "channel", key: "channel", width: 130,
    render: (v: PaymentChannel) => PAYMENT_CHANNEL_LABELS[v] },
  { title: "Người thực hiện", dataIndex: "staffName", key: "staffName", width: 160,
    render: (v: string | null) => v ?? "—" },
  { title: "Duyệt", dataIndex: "approvalStatus", key: "approvalStatus", width: 110,
    render: (v: SalesApprovalStatus) => {
      const config = APPROVAL_CONFIG[v];
      return config ? <Tag color={config.color}>{config.label}</Tag> : <Text type="secondary">—</Text>;
    } },
  { title: "Thao tác", key: "actions", width: 200, render: (_: unknown, row: SalesEntryDto) => actions(row) },
  ];
}

const RESULT_COLUMNS = [
  { title: "Danh mục", dataIndex: "category", key: "category" },
  { title: "Doanh thu", dataIndex: "revenue", key: "revenue", width: 160, align: "right" as const,
    render: (v: number) => <Text style={{ fontVariantNumeric: "tabular-nums" }}>{formatVND(v ?? 0)} đ</Text> },
  { title: "Chi phí", dataIndex: "expense", key: "expense", width: 160, align: "right" as const,
    render: (v: number) => <Text style={{ color: "#EF4444", fontVariantNumeric: "tabular-nums" }}>{formatVND(v ?? 0)} đ</Text> },
  { title: "Lợi nhuận", dataIndex: "profit", key: "profit", width: 160, align: "right" as const,
    render: (v: number) => <Text style={{ color: "#10B981", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{formatVND(v ?? 0)} đ</Text> },
  { title: "Tỷ lệ LN (%)", dataIndex: "margin", key: "margin", width: 120, align: "right" as const,
    render: (v: number) => <Text style={{ color: v >= 0 ? "#10B981" : "#EF4444" }}>{v ?? 0}%</Text> },
];

const EXPENSE_COLUMNS = [
  { title: "Ngày", dataIndex: "date", key: "date", width: 110 },
  { title: "Tên khách hàng", dataIndex: "patientName", key: "patientName", width: 180 },
  { title: "Nhân sự tư vấn", dataIndex: "counselorName", key: "counselorName", width: 150 },
  { title: "Bác sĩ tiếp nhận", dataIndex: "doctorName", key: "doctorName", width: 150 },
  { title: "Dịch vụ điều trị", dataIndex: "serviceName", key: "serviceName" },
  { title: "Số lượng", dataIndex: "quantity", key: "quantity", width: 90, align: "right" as const },
  { title: "Thành tiền", dataIndex: "totalAmount", key: "totalAmount", width: 130, align: "right" as const, render: (v: number) => <Text style={{ fontVariantNumeric: "tabular-nums" }}>{formatVND(v ?? 0)} đ</Text> },
  { title: "Đã thanh toán", dataIndex: "paidAmount", key: "paidAmount", width: 130, align: "right" as const, render: (v: number) => <Text style={{ color: "#10B981", fontVariantNumeric: "tabular-nums" }}>{formatVND(v ?? 0)} đ</Text> },
];

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
          items={REPORT_TABS.map((t) => ({ key: t.key, label: t.label }))}
        />
      </div>

      {/* Shared toolbar */}
      <div className="reception-card reception-card--toolbar">
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <Segmented
            value={dateMode}
            onChange={(v) => setDateMode(v as DateMode)}
            options={[
              { label: "Ngày",  value: "day" },
              { label: "Tuần",  value: "week" },
              { label: "Tháng", value: "month" },
              { label: "Năm",   value: "year" },
            ]}
          />
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <Button type="text" size="small" icon={<LeftOutlined />} onClick={() => navigateDate(-1)} />
            <span style={{ minWidth: 130, textAlign: "center", fontWeight: 600, fontSize: 14 }}>{displayDate()}</span>
            <Button type="text" size="small" icon={<RightOutlined />} onClick={() => navigateDate(1)} />
          </div>
          <Select placeholder="Bác sĩ điều trị" allowClear style={{ minWidth: 180 }} options={[]} />
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
              <span style={{ fontSize: 13, color: "#5A6B82" }}>Doanh số:</span>
              <span style={{ fontWeight: 700, fontSize: 18, color: "#1B2A41" }}>0 đ</span>
              <Button icon={<DownloadOutlined />} style={{ marginLeft: "auto" }}>Xuất Excel</Button>
            </div>
          </div>

          {/* Table */}
          <div className="reception-card reception-card--content">
            <Table
              size="small"
              rowKey="id"
              columns={EXPENSE_COLUMNS}
              dataSource={[]}
              pagination={{
                pageSize: 20,
                showSizeChanger: true,
                pageSizeOptions: ["5", "10", "20", "25", "50", "100"],
                showTotal: (total, range) => `Hiển thị ${range[0]}–${range[1]} trên ${total} dòng`,
              }}
              locale={{ emptyText: "Không có dữ liệu" }}
            />
          </div>

          {/* Summary cards */}
          <Row gutter={[12, 12]}>
            {SUMMARY_CARDS.map((card) => (
              <Col key={card.title} xs={24} sm={12} md={6}>
                <div className="reception-card" style={{ padding: 16 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, color: "#1B2A41", marginBottom: 10 }}>{card.title}</div>
                  {card.metrics.map((m) => (
                    <div key={m.label} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                      <span style={{ color: "#5A6B82" }}>{m.label}</span>
                      <span style={{ fontWeight: 600, color: "#1B2A41" }}>{m.value.toLocaleString("vi-VN")} {m.unit}</span>
                    </div>
                  ))}
                </div>
              </Col>
            ))}
          </Row>
        </>
      )}

      {activeTab === "cashflow" && <CashflowTab period={period} />}
      {activeTab === "result" && <BusinessResultTab />}
      {activeTab === "cashflow-v2" && <CashflowV2Tab period={period} />}
    </div>
  );
}

const APPROVAL_CONFIG: Record<SalesApprovalStatus, { label: string; color: string } | null> = {
  [SALES_APPROVAL_STATUS.NotRequired]: null,
  [SALES_APPROVAL_STATUS.Pending]: { label: "Chờ duyệt", color: "gold" },
  [SALES_APPROVAL_STATUS.Approved]: { label: "Đã duyệt", color: "green" },
  [SALES_APPROVAL_STATUS.Rejected]: { label: "Từ chối", color: "red" },
};

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
      message.success("Đã duyệt phiếu chi");
    } catch (error) {
      message.error(extractApiError(error));
    }
  };

  const handleReject = (row: SalesEntryDto) => {
    if (!currentUserId) return;
    let reason = "";

    Modal.confirm({
      title: `Từ chối phiếu ${row.code}`,
      content: (
        <Input.TextArea
          rows={3}
          placeholder="Lý do từ chối"
          onChange={(e) => { reason = e.target.value; }}
        />
      ),
      okText: "Từ chối",
      cancelText: "Huỷ",
      onOk: async () => {
        if (!reason.trim()) {
          message.error("Vui lòng nhập lý do từ chối.");
          throw new Error("missing reason");
        }
        try {
          await rejectEntry.mutateAsync({ id: row.id, staffId: currentUserId, reason: reason.trim() });
          message.success("Đã từ chối phiếu chi");
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
          <Button type="link" size="small" onClick={() => handleApprove(row)}>Duyệt</Button>
          <Button type="link" size="small" danger onClick={() => handleReject(row)}>Từ chối</Button>
        </>
      )}
      {row.approvalStatus !== SALES_APPROVAL_STATUS.Approved && (
        <>
          <Button type="link" size="small" onClick={() => { setEditing(row); setModalOpen(true); }}>
            Sửa
          </Button>
          <Popconfirm
            title="Xoá phiếu này?"
            okText="Xoá"
            cancelText="Huỷ"
            onConfirm={async () => {
              try {
                await deleteEntry.mutateAsync(row.id);
                message.success("Đã xoá phiếu");
              } catch (error) {
                message.error(extractApiError(error));
              }
            }}
          >
            <Button type="link" size="small" danger>Xoá</Button>
          </Popconfirm>
        </>
      )}
    </>
  ));

  const summaryCards = [
    { label: "Tổng thu", value: stats?.totalIncome ?? 0, color: "#10B981" },
    { label: "Tổng chi", value: stats?.totalExpense ?? 0, color: "#EF4444" },
    { label: "Lợi nhuận ước tính", value: stats?.net ?? 0, color: "#1E70E6" },
  ];

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
            {stats?.pendingExpenseCount} phiếu chi đang chờ duyệt ({formatVND(stats?.pendingExpense ?? 0)} đ) —
            chưa được tính vào tổng chi.
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
            Thêm mới
          </Button>
          <Button icon={<DownloadOutlined />} style={{ marginLeft: "auto" }}>Xuất Excel</Button>
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
            showTotal: (total, range) => `Hiển thị ${range[0]}–${range[1]} trên ${total} dòng`,
          }}
          locale={{ emptyText: "Không có dữ liệu" }}
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

const CASHFLOW_ENTRY_COLUMNS = [
  { title: "Ngày", dataIndex: "entryDate", key: "entryDate", width: 110, render: (v: string) => formatDate(v) },
  { title: "Loại giao dịch", dataIndex: "transactionType", key: "transactionType", width: 130,
    render: (v: CashTransactionType) => <Tag>{CASH_TRANSACTION_LABELS[v]}</Tag> },
  { title: "Hình thức", key: "holding", width: 200,
    render: (_: unknown, r: { fromHolding: CashHolding | null; toHolding: CashHolding | null }) => {
      const from = r.fromHolding ? CASH_HOLDING_LABELS[r.fromHolding] : null;
      const to = r.toHolding ? CASH_HOLDING_LABELS[r.toHolding] : null;
      if (from && to) return `${from} → ${to}`;
      return to ?? from ?? "—";
    } },
  { title: "Danh mục", dataIndex: "categoryName", key: "categoryName", width: 160,
    render: (v: string | null) => v ?? "—" },
  { title: "Số tiền", dataIndex: "amount", key: "amount", width: 140, align: "right" as const,
    render: (v: number) => <Text style={{ fontVariantNumeric: "tabular-nums" }}>{formatVND(v ?? 0)} đ</Text> },
  { title: "Người tạo", dataIndex: "createdByStaffName", key: "createdByStaffName", width: 160,
    render: (v: string | null) => v ?? "—" },
  { title: "Ghi chú", dataIndex: "note", key: "note", render: (v: string | null) => v ?? "—" },
];

function CashflowV2Tab({ period }: { period: PeriodRange }) {
  const branchId = useCurrentBranchId();
  const params = { clinicBranchId: branchId, ...period };
  const [cashModal, setCashModal] = useState<CashTransactionType | null>(null);

  const { data: overview } = useCashflowOverview(params);
  const { data: page, isLoading } = useCashflowEntries({ ...params, maxResultCount: 100 });

  // Panel order and wording follow the reference "Luân chuyển dòng tiền V2" tab.
  const balancePanels = [
    { label: "Tổng Tiền", value: overview?.balance.total ?? 0, color: "#1B2A41" },
    { label: "Tổng Tiền Mặt", value: overview?.balance.cash ?? 0, color: "#10B981" },
    { label: "Tổng Chuyển Khoản", value: overview?.balance.bank ?? 0, color: "#1E70E6" },
    { label: "Đang Giữ Hộ Khách", value: overview?.balance.customerPrepaid ?? 0, color: "#F59E0B" },
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
          <Button type="primary" onClick={() => setCashModal(CASH_TRANSACTION_TYPE.Deposit)}>Nạp</Button>
          <Button onClick={() => setCashModal(CASH_TRANSACTION_TYPE.Withdraw)}>Rút</Button>
          <Button onClick={() => setCashModal(CASH_TRANSACTION_TYPE.Transfer)}>Luân chuyển</Button>
          <Text style={{ fontSize: 13, color: "#5A6B82", marginLeft: 12 }}>
            Nạp: {formatVND(overview?.totalDeposit ?? 0)} đ · Rút: {formatVND(overview?.totalWithdraw ?? 0)} đ ·
            Luân chuyển: {formatVND(overview?.totalTransfer ?? 0)} đ
          </Text>
          <Button icon={<DownloadOutlined />} style={{ marginLeft: "auto" }}>Xuất Excel</Button>
        </div>
      </div>

      <div className="reception-card reception-card--content">
        <Table
          size="small"
          rowKey="id"
          loading={isLoading}
          columns={CASHFLOW_ENTRY_COLUMNS}
          dataSource={page?.items ?? []}
          pagination={{
            pageSize: 20,
            showTotal: (total, range) => `Hiển thị ${range[0]}–${range[1]} trên ${total} giao dịch`,
          }}
          locale={{ emptyText: "Không có dữ liệu" }}
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
  const resultSummary = [
    { label: "Doanh thu", value: 0, color: "#1E70E6" },
    { label: "Chi phí", value: 0, color: "#EF4444" },
    { label: "Lợi nhuận", value: 0, color: "#10B981" },
    { label: "Tỷ lệ lợi nhuận", value: "0%", color: "#F59E0B" },
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
          <Button icon={<DownloadOutlined />} style={{ marginLeft: "auto" }}>Xuất Excel</Button>
        </div>
      </div>

      <div className="reception-card reception-card--content">
        <Table
          size="small"
          rowKey="category"
          columns={RESULT_COLUMNS}
          dataSource={[]}
          pagination={false}
          locale={{ emptyText: "Không có dữ liệu" }}
          summary={() => (
            <Table.Summary.Row>
              <Table.Summary.Cell index={0}><Text strong>Tổng</Text></Table.Summary.Cell>
              <Table.Summary.Cell index={1} align="right"><Text strong style={{ fontVariantNumeric: "tabular-nums" }}>0 đ</Text></Table.Summary.Cell>
              <Table.Summary.Cell index={2} align="right"><Text strong style={{ color: "#EF4444", fontVariantNumeric: "tabular-nums" }}>0 đ</Text></Table.Summary.Cell>
              <Table.Summary.Cell index={3} align="right"><Text strong style={{ color: "#10B981", fontVariantNumeric: "tabular-nums" }}>0 đ</Text></Table.Summary.Cell>
              <Table.Summary.Cell index={4} align="right"><Text strong>0%</Text></Table.Summary.Cell>
            </Table.Summary.Row>
          )}
        />
      </div>
    </>
  );
}
