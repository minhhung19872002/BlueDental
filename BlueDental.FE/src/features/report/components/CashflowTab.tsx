import { useCallback, useMemo, useState } from "react";
import { Button, Space } from "antd";
import { DownloadOutlined, PlusOutlined } from "@ant-design/icons";
import { toast } from "sonner";
import { PillTabs } from "@/components/PillTabs";
import { t } from "@/lib/i18n";
import { useCurrentBranchId } from "@/lib/clinicBranch";
import { formatDate } from "@/utils/format";
import { exportToExcel, type ExportColumn, type ExportOptions } from "@/utils/exportExcel";
import {
  paymentChannelLabels,
  SALES_ENTRY_TYPE,
  useSalesEntries,
  type PaymentChannel,
  type SalesApprovalStatus,
  type SalesEntryDto,
  type SalesEntryType,
} from "../api/financeApi";
import type { RangeQuery } from "../api/clinicReportApi";
import type { CashflowSubKey } from "../hooks/useReportUrlState";
import { REPORT_PERMISSION, useReportPermission, type ReportPermission } from "../hooks/useReportPermissions";
import { approvalStatusLabel } from "./cashflowColumns";
import { CashflowIncomeView } from "./CashflowIncomeView";
import { CashflowExpenseView } from "./CashflowExpenseView";
import { CashflowCategoryManager } from "./CashflowCategoryManager";
import { SalesEntryModal } from "./SalesEntryModal";
import { ReportOverviewSection } from "./ReportOverviewSection";

type SubKey = CashflowSubKey;

/** Each pill needs its subject's `read`, like the reference's `can(subject, "read")` filter. */
const SUB_TABS: { key: SubKey; label: () => string }[] = [
  { key: "income", label: () => t("Report:Tab:Income") },
  { key: "expense", label: () => t("Report:Tab:Expense") },
  { key: "category", label: () => t("Report:Tab:Category") },
];

const SUB_ACTIONS: Record<Exclude<SubKey, "category">, { export: ReportPermission; create: ReportPermission }> = {
  income: { export: REPORT_PERMISSION.incomeExport, create: REPORT_PERMISSION.incomeCreate },
  expense: { export: REPORT_PERMISSION.costExport, create: REPORT_PERMISSION.costCreate },
};

const SUB_TYPE: Record<Exclude<SubKey, "category">, SalesEntryType> = {
  income: SALES_ENTRY_TYPE.Income,
  expense: SALES_ENTRY_TYPE.Expense,
};

type SalesExportColumn = ExportColumn<SalesEntryDto>;

/*
 * Both workbooks are built client-side on the reference: a merged title row,
 * a blank row, then the headers, with fixed column widths and the fallbacks
 * below ("—" for a missing customer / content / category, "Không xác định"
 * for a missing staff name). Amounts stay numeric.
 */
const EMPTY = "—";
const dateCell = (v: unknown) => formatDate(String(v));
const textOrDash = (v: unknown) => String(v ?? "").trim() || EMPTY;
const staffOrUnknown = (v: unknown) => String(v ?? "").trim() || t("Report:Unknown");

/** The workbook's customer: the linked patient, else the typed payer / receiver, else "—". */
function customerColumn(): SalesExportColumn {
  return { header: t("Report:Column:Customer"), key: "patientName", format: textOrDash };
}

function withCustomerFallback(rows: SalesEntryDto[]): SalesEntryDto[] {
  return rows.map((row) => (row.patientName ? row : { ...row, patientName: row.payerName ?? null }));
}

function dateColumn(header: string): SalesExportColumn {
  return { header, key: "entryDate", format: dateCell };
}

function amountColumn(header: string): SalesExportColumn {
  return { header, key: "amount" };
}

function channelColumn(): SalesExportColumn {
  const labels = paymentChannelLabels();
  return { header: t("Report:Column:PaymentMethod"), key: "channel", format: (v: unknown) => labels[v as PaymentChannel] ?? EMPTY };
}

interface SalesExport {
  filename: string;
  columns: SalesExportColumn[];
  options: ExportOptions;
}

function buildIncomeExport(): SalesExport {
  return {
    filename: "thu-nhap",
    columns: [
      dateColumn(t("Report:Column:CreatedDate")),
      customerColumn(),
      { header: t("Report:Column:IncomeDescription"), key: "description", format: textOrDash },
      { header: t("Report:Column:IncomeStaff"), key: "staffName", format: staffOrUnknown },
      { header: t("Report:Column:IncomeCategory"), key: "categoryName", format: textOrDash },
      amountColumn(t("Report:Column:Revenue")),
      channelColumn(),
    ],
    options: {
      sheetName: t("Report:Tab:Income"),
      title: t("Report:Export:IncomeTitle"),
      columnWidths: [16, 22, 28, 18, 18, 18, 16],
    },
  };
}

function buildExpenseExport(): SalesExport {
  return {
    filename: "chi-phi",
    columns: [
      dateColumn(t("Report:Column:CreatedDate")),
      dateColumn(t("Report:Column:ActualExpenseDate")),
      { header: t("Report:Column:Description"), key: "description", format: textOrDash },
      customerColumn(),
      { header: t("Report:Column:Staff"), key: "staffName", format: staffOrUnknown },
      { header: t("Report:Column:ExpenseCategory"), key: "categoryName", format: textOrDash },
      amountColumn(t("Report:Column:TotalMoney")),
      channelColumn(),
      {
        header: t("Common:Status"),
        key: "approvalStatus",
        format: (v: unknown) => approvalStatusLabel(v as SalesApprovalStatus),
      },
    ],
    options: {
      sheetName: t("Report:Tab:Expense"),
      title: t("Report:Export:ExpenseTitle"),
      columnWidths: [16, 16, 28, 18, 18, 18, 18, 16, 14],
    },
  };
}

interface Props extends RangeQuery {
  sub: SubKey;
  onSubChange: (sub: SubKey) => void;
}

/** Tab "Quản lý thu chi": Thu nhập / Chi phí / Danh mục with Xuất Excel + Thêm mới on the pill row. */
export function CashflowTab({ sub: rawSub, onSubChange, ...range }: Props) {
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<SalesEntryDto | null>(null);

  const branchId = useCurrentBranchId();
  const { data: pagedEntries, isLoading } = useSalesEntries({
    clinicBranchId: branchId,
    fromDate: range.fromDate,
    toDate: range.toDate,
    maxResultCount: 1000,
  });
  const entries = useMemo(() => pagedEntries?.items ?? [], [pagedEntries]);

  const mayReadIncome = useReportPermission(REPORT_PERMISSION.incomeRead);
  const mayReadCost = useReportPermission(REPORT_PERMISSION.costRead);
  const mayReadCategory = useReportPermission(REPORT_PERMISSION.cashflowCategoryRead);
  const items = useMemo(() => {
    const readable: Record<SubKey, boolean> = { income: mayReadIncome, expense: mayReadCost, category: mayReadCategory };
    return SUB_TABS.filter((s) => readable[s.key]).map((s) => ({ key: s.key, label: s.label() }));
  }, [mayReadIncome, mayReadCost, mayReadCategory]);
  const sub: SubKey = items.some((i) => i.key === rawSub) ? rawSub : (items[0]?.key as SubKey) ?? "income";
  const actions = sub === "category" ? null : SUB_ACTIONS[sub];
  const mayExport = useReportPermission(actions?.export ?? REPORT_PERMISSION.incomeExport);
  const mayCreate = useReportPermission(actions?.create ?? REPORT_PERMISSION.incomeCreate);

  const handleCreate = useCallback(() => {
    setEditing(null);
    setEditorOpen(true);
  }, []);
  const handleEdit = useCallback((entry: SalesEntryDto) => {
    setEditing(entry);
    setEditorOpen(true);
  }, []);
  const handleClose = useCallback(() => setEditorOpen(false), []);

  // The reference refuses an empty workbook with a warning and confirms a written one.
  const handleExport = useCallback(() => {
    if (sub === "category") return;
    const rows = entries.filter((e) => e.type === SUB_TYPE[sub]);
    if (rows.length === 0) {
      toast.warning(t("Report:Export:NoData"));
      return;
    }
    const { filename, columns, options } = sub === "income" ? buildIncomeExport() : buildExpenseExport();
    exportToExcel<SalesEntryDto>(withCustomerFallback(rows), columns, filename, options);
    toast.success(t("Report:Export:Success"));
  }, [entries, sub]);

  const extra = actions !== null && (mayExport || mayCreate) && (
    <Space wrap>
      {mayExport && (
        <Button icon={<DownloadOutlined />} onClick={handleExport}>
          {t("Report:Action:ExportExcel")}
        </Button>
      )}
      {mayCreate && (
        <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
          {t("Common:Add")}
        </Button>
      )}
    </Space>
  );

  return (
    <div className="report-tab">
      <PillTabs
        className="report-sub-tabs"
        items={items}
        activeKey={sub}
        onChange={(key) => onSubChange(key as SubKey)}
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
