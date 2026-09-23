import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Space } from "antd";
import {
  DownloadOutlined,
  SwapOutlined,
  VerticalAlignBottomOutlined,
  VerticalAlignTopOutlined,
} from "@ant-design/icons";
import { toast } from "sonner";
import { PillTabs } from "@/components/PillTabs";
import { useTablePagination } from "@/hooks/useTablePagination";
import { t } from "@/lib/i18n";
import { useCurrentBranchId } from "@/lib/clinicBranch";
import { formatDate } from "@/utils/format";
import { exportToExcel, type ExportColumn } from "@/utils/exportExcel";
import {
  CASH_TRANSACTION_TYPE,
  cashTransactionLabels,
  formatCashMovement,
  useCashflowEntries,
  type CashflowEntryDto,
  type CashTransactionType,
} from "../api/financeApi";
import { REPORT_PERMISSION, useReportPermission } from "../hooks/useReportPermissions";
import { CashflowV2Overview } from "./CashflowV2Overview";
import { CashflowCategoryManager } from "./CashflowCategoryManager";
import { CashflowEntryModal } from "./CashflowEntryModal";
import { REPORT_PAGE_SIZE_OPTIONS, reportShowTotal } from "./ReportTableCard";

type SubKey = "overview" | "category";

const SUB_TABS: { key: SubKey; label: () => string }[] = [
  { key: "overview", label: () => t("Report:Tab:Overview") },
  { key: "category", label: () => t("Report:Tab:Category") },
];

interface EditorState {
  transactionType: CashTransactionType;
  entry: CashflowEntryDto | null;
}

interface CashflowExportRow {
  entryDate: string;
  transactionType: string;
  movement: string;
  categoryName: string;
  amount: number;
  createdByName: string;
  note: string;
}

/** A withdrawal leaves the workbook as a negative amount, like the reference. */
function signedAmount(entry: CashflowEntryDto): number {
  return entry.transactionType === CASH_TRANSACTION_TYPE.Withdraw ? -entry.amount : entry.amount;
}

function toExportRow(entry: CashflowEntryDto, types: Record<CashTransactionType, string>): CashflowExportRow {
  return {
    entryDate: formatDate(entry.entryDate),
    transactionType: types[entry.transactionType],
    movement: formatCashMovement(entry.fromHolding, entry.toHolding),
    categoryName: entry.categoryName ?? "",
    amount: signedAmount(entry),
    createdByName: entry.createdByStaffName ?? t("Report:Unknown"),
    note: entry.note ?? "",
  };
}

function buildExportColumns(): ExportColumn<CashflowExportRow>[] {
  return [
    { header: t("Report:Column:Date"), key: "entryDate" },
    { header: t("Report:Column:TransactionType"), key: "transactionType" },
    { header: t("Report:Column:PaymentMethod"), key: "movement" },
    { header: t("Report:Column:Category"), key: "categoryName" },
    { header: t("Report:Column:Amount"), key: "amount" },
    { header: t("Report:Column:Creator"), key: "createdByName" },
    { header: t("Common:Note"), key: "note" },
  ];
}

/** Title row + blank row + headers, fixed widths — the reference's client-side workbook. */
const EXPORT_OPTIONS = {
  sheetName: () => t("Report:Tab:CashTransfer"),
  title: () => t("Report:Export:CashTransferTitle"),
  columnWidths: [16, 18, 20, 18, 18, 18, 28],
};

/**
 * Tab "Luân chuyển dòng tiền V2": Tổng quan / Danh mục + Nạp / Rút / Luân chuyển actions.
 * The reference locks this tab's period to "Tổng": the ledger is the whole
 * branch history paged on the server, and the balance panels are the running
 * balance, so neither follows the toolbar date.
 */
export function CashflowV2Tab() {
  const [rawSub, setRawSub] = useState<SubKey>("overview");
  const [editor, setEditor] = useState<EditorState | null>(null);
  const branchId = useCurrentBranchId();
  const pagination = useTablePagination(20, { pageSizeOptions: REPORT_PAGE_SIZE_OPTIONS });
  const { resetToFirstPage } = pagination;

  useEffect(() => {
    resetToFirstPage();
  }, [branchId, resetToFirstPage]);

  const { data: pagedEntries, isLoading } = useCashflowEntries({
    clinicBranchId: branchId,
    skipCount: pagination.skipCount,
    maxResultCount: pagination.maxResultCount,
  });
  const rows = useMemo(() => pagedEntries?.items ?? [], [pagedEntries]);

  // Each pill and button needs its `reportTransfer` / `reportTransferCategory` grant, as on the reference.
  const mayReadLedger = useReportPermission(REPORT_PERMISSION.transferRead);
  const mayReadCategory = useReportPermission(REPORT_PERMISSION.transferCategoryRead);
  const mayExport = useReportPermission(REPORT_PERMISSION.transferExport);
  const mayTransfer = useReportPermission(REPORT_PERMISSION.transferTransfer);
  const mayDeposit = useReportPermission(REPORT_PERMISSION.transferDeposit);
  const mayWithdraw = useReportPermission(REPORT_PERMISSION.transferWithdraw);
  const items = useMemo(() => {
    const readable: Record<SubKey, boolean> = { overview: mayReadLedger, category: mayReadCategory };
    return SUB_TABS.filter((s) => readable[s.key]).map((s) => ({ key: s.key, label: s.label() }));
  }, [mayReadLedger, mayReadCategory]);
  const sub: SubKey = items.some((i) => i.key === rawSub) ? rawSub : (items[0]?.key as SubKey) ?? "overview";
  const setSub = setRawSub;

  const openCreate = useCallback(
    (transactionType: CashTransactionType) => setEditor({ transactionType, entry: null }),
    [],
  );
  const handleEdit = useCallback(
    (entry: CashflowEntryDto) => setEditor({ transactionType: entry.transactionType, entry }),
    [],
  );
  const closeEditor = useCallback(() => setEditor(null), []);

  // The reference exports what is on screen (the current page, not the whole
  // ledger), refuses an empty page with a warning and confirms a written file.
  const handleExport = useCallback(() => {
    if (rows.length === 0) {
      toast.warning(t("Report:Export:NoData"));
      return;
    }
    const types = cashTransactionLabels();
    exportToExcel(rows.map((e) => toExportRow(e, types)), buildExportColumns(), "luan-chuyen-dong-tien", {
      sheetName: EXPORT_OPTIONS.sheetName(),
      title: EXPORT_OPTIONS.title(),
      columnWidths: EXPORT_OPTIONS.columnWidths,
    });
    toast.success(t("Report:Export:Success"));
  }, [rows]);

  const anyAction = mayExport || mayTransfer || mayDeposit || mayWithdraw;
  const extra = sub === "overview" && anyAction && (
    <Space wrap className="report-cashflow-v2-actions">
      {mayExport && (
        <Button icon={<DownloadOutlined />} onClick={handleExport}>
          {t("Report:Action:ExportExcel")}
        </Button>
      )}
      {mayTransfer && (
        <Button icon={<SwapOutlined />} className="report-btn--blue" onClick={() => openCreate(CASH_TRANSACTION_TYPE.Transfer)}>
          {t("Report:Action:Transfer")}
        </Button>
      )}
      {mayDeposit && (
        <Button type="primary" icon={<VerticalAlignBottomOutlined />} className="report-btn--green" onClick={() => openCreate(CASH_TRANSACTION_TYPE.Deposit)}>
          {t("Report:Action:Deposit")}
        </Button>
      )}
      {mayWithdraw && (
        <Button danger icon={<VerticalAlignTopOutlined />} onClick={() => openCreate(CASH_TRANSACTION_TYPE.Withdraw)}>
          {t("Report:Action:Withdraw")}
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
        onChange={(key) => setSub(key as SubKey)}
        extra={extra || undefined}
      />

      {sub === "overview" && (
        <CashflowV2Overview
          rows={rows}
          loading={isLoading}
          pagination={pagination.buildConfig(pagedEntries?.totalCount, reportShowTotal(t("Report:Unit:Transaction")))}
          onEdit={handleEdit}
        />
      )}
      {sub === "category" && <CashflowCategoryManager variant="cashbook" />}

      <CashflowEntryModal
        open={editor !== null}
        transactionType={editor?.transactionType ?? CASH_TRANSACTION_TYPE.Deposit}
        entry={editor?.entry ?? null}
        onClose={closeEditor}
      />
    </div>
  );
}
