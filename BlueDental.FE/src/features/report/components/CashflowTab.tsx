import { useCallback, useMemo, useState } from "react";
import { Button, Space } from "antd";
import { DownloadOutlined, PlusOutlined } from "@ant-design/icons";
import { PillTabs } from "@/components/PillTabs";
import { t } from "@/lib/i18n";
import { formatDate, formatVND } from "@/utils/format";
import { exportToExcel, type ExportColumn } from "@/utils/exportExcel";
import {
  paymentChannelLabels,
  SALES_ENTRY_TYPE,
  type PaymentChannel,
  type SalesApprovalStatus,
  type SalesEntryType,
} from "../api/financeApi";
import { useMockSalesEntries, type RangeQuery } from "../api/reportMockQueries";
import type { SalesEntryVm } from "../types/mock";
import { approvalStatusLabel } from "./cashflowColumns";
import { CashflowIncomeView } from "./CashflowIncomeView";
import { CashflowExpenseView } from "./CashflowExpenseView";
import { CashflowCategoryManager } from "./CashflowCategoryManager";
import { SalesEntryModal } from "./SalesEntryModal";
import { ReportOverviewSection } from "./ReportOverviewSection";

type SubKey = "income" | "expense" | "category";

const SUB_TABS: { key: SubKey; label: () => string }[] = [
  { key: "income", label: () => t("Thu nhập") },
  { key: "expense", label: () => t("Chi phí") },
  { key: "category", label: () => t("Danh mục") },
];

const SUB_TYPE: Record<Exclude<SubKey, "category">, SalesEntryType> = {
  income: SALES_ENTRY_TYPE.Income,
  expense: SALES_ENTRY_TYPE.Expense,
};

type SalesExportColumn = ExportColumn<SalesEntryVm>;

const DATE_COLUMN: SalesExportColumn = {
  header: t("Ngày tạo"),
  key: "entryDate",
  format: (v: unknown) => formatDate(String(v)),
};

const PATIENT_COLUMNS: SalesExportColumn[] = [
  { header: t("Mã khách hàng"), key: "patientCode" },
  { header: t("Tên khách hàng"), key: "patientName" },
];

function amountColumn(header: string): SalesExportColumn {
  return { header, key: "amount", format: (v: unknown) => formatVND(Number(v)) };
}

function channelColumn(): SalesExportColumn {
  const labels = paymentChannelLabels();
  return { header: t("Hình thức"), key: "channel", format: (v: unknown) => labels[v as PaymentChannel] ?? "" };
}

/** Income workbook: the customer split into code + name right after "Ngày tạo". */
function buildIncomeExportColumns(): SalesExportColumn[] {
  return [
    { header: t("Mã phiếu"), key: "code" },
    DATE_COLUMN,
    ...PATIENT_COLUMNS,
    { header: t("Nội dung thu"), key: "description" },
    { header: t("Nhân viên thu"), key: "staffName" },
    { header: t("Mục thu"), key: "categoryName" },
    amountColumn(t("Doanh thu")),
    channelColumn(),
  ];
}

/** Expense workbook mirrors the Chi phí table: paid date, customer, then approval status last. */
function buildExpenseExportColumns(): SalesExportColumn[] {
  return [
    { header: t("Mã phiếu"), key: "code" },
    DATE_COLUMN,
    { header: t("Ngày thực chi"), key: "paidDate", format: (v: unknown) => formatDate(String(v)) },
    ...PATIENT_COLUMNS,
    { header: t("Nội dung"), key: "description" },
    { header: t("Nhân viên"), key: "staffName" },
    { header: t("Mục chi"), key: "categoryName" },
    amountColumn(t("Tổng tiền")),
    channelColumn(),
    {
      header: t("Trạng thái"),
      key: "approvalStatus",
      format: (v: unknown) => approvalStatusLabel(v as SalesApprovalStatus),
    },
  ];
}

/** Tab "Quản lý thu chi": Thu nhập / Chi phí / Danh mục with Xuất Excel + Thêm mới on the pill row. */
export function CashflowTab(range: RangeQuery) {
  const [sub, setSub] = useState<SubKey>("income");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<SalesEntryVm | null>(null);

  const { data: entries = [], isLoading } = useMockSalesEntries(range);
  const items = useMemo(() => SUB_TABS.map((s) => ({ key: s.key, label: s.label() })), []);

  const handleCreate = useCallback(() => {
    setEditing(null);
    setEditorOpen(true);
  }, []);
  const handleEdit = useCallback((entry: SalesEntryVm) => {
    setEditing(entry);
    setEditorOpen(true);
  }, []);
  const handleClose = useCallback(() => setEditorOpen(false), []);

  const handleExport = useCallback(() => {
    if (sub === "category") return;
    const rows = entries.filter((e) => e.type === SUB_TYPE[sub]);
    const columns = sub === "income" ? buildIncomeExportColumns() : buildExpenseExportColumns();
    exportToExcel<SalesEntryVm>(rows, columns, `thu-chi-${sub}-${range.fromDate}-${range.toDate}`);
  }, [entries, sub, range.fromDate, range.toDate]);

  const extra = sub !== "category" && (
    <Space wrap>
      <Button icon={<DownloadOutlined />} onClick={handleExport}>
        {t("Xuất Excel")}
      </Button>
      <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
        {t("Thêm mới")}
      </Button>
    </Space>
  );

  return (
    <div className="report-tab">
      <PillTabs
        className="report-sub-tabs"
        items={items}
        activeKey={sub}
        onChange={(key) => setSub(key as SubKey)}
        extra={extra || undefined}
      />

      {sub === "income" && <CashflowIncomeView entries={entries} loading={isLoading} onEdit={handleEdit} />}
      {sub === "expense" && <CashflowExpenseView entries={entries} loading={isLoading} onEdit={handleEdit} />}
      {sub === "category" && <CashflowCategoryManager variant="sales" />}

      {sub !== "category" && <ReportOverviewSection variant="income-expense" range={range} />}

      <SalesEntryModal
        open={editorOpen}
        entry={editing}
        defaultType={sub === "category" ? SALES_ENTRY_TYPE.Income : SUB_TYPE[sub]}
        onClose={handleClose}
      />
    </div>
  );
}
