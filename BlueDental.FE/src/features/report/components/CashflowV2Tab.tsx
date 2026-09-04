import { useCallback, useMemo, useState } from "react";
import { Button, Space } from "antd";
import {
  DownloadOutlined,
  SwapOutlined,
  VerticalAlignBottomOutlined,
  VerticalAlignTopOutlined,
} from "@ant-design/icons";
import { PillTabs } from "@/components/PillTabs";
import { t } from "@/lib/i18n";
import { formatDate, formatVND } from "@/utils/format";
import { exportToExcel, type ExportColumn } from "@/utils/exportExcel";
import {
  CASH_TRANSACTION_TYPE,
  cashTransactionLabels,
  formatCashMovement,
  type CashTransactionType,
} from "../api/financeApi";
import { useMockCashflowEntries } from "../api/reportMockQueries";
import type { CashflowEntryVm } from "../types/mock";
import { CashflowV2Overview } from "./CashflowV2Overview";
import { CashflowCategoryManager } from "./CashflowCategoryManager";
import { CashflowEntryModal } from "./CashflowEntryModal";

type SubKey = "overview" | "category";

const SUB_TABS: { key: SubKey; label: () => string }[] = [
  { key: "overview", label: () => t("Tổng quan") },
  { key: "category", label: () => t("Danh mục") },
];

interface EditorState {
  transactionType: CashTransactionType;
  entry: CashflowEntryVm | null;
}

/** One spreadsheet row: the table's columns, with the derived ones flattened. */
interface CashflowExportRow {
  entryDate: string;
  transactionType: string;
  movement: string;
  categoryName: string;
  amount: number;
  createdByName: string;
  note: string;
}

function toExportRow(entry: CashflowEntryVm, types: Record<CashTransactionType, string>): CashflowExportRow {
  return {
    entryDate: formatDate(entry.entryDate),
    transactionType: types[entry.transactionType],
    movement: formatCashMovement(entry.fromHolding, entry.toHolding),
    categoryName: entry.categoryName ?? "",
    amount: entry.amount,
    createdByName: entry.createdByName,
    note: entry.note ?? "",
  };
}

function buildExportColumns(): ExportColumn<CashflowExportRow>[] {
  return [
    { header: t("Ngày"), key: "entryDate" },
    { header: t("Loại giao dịch"), key: "transactionType" },
    { header: t("Hình thức"), key: "movement" },
    { header: t("Danh mục"), key: "categoryName" },
    { header: t("Số tiền"), key: "amount", format: (v: unknown) => formatVND(Number(v)) },
    { header: t("Người tạo"), key: "createdByName" },
    { header: t("Ghi chú"), key: "note" },
  ];
}

/** Tab "Luân chuyển dòng tiền V2": Tổng quan / Danh mục + Nạp / Rút / Luân chuyển actions. */
export function CashflowV2Tab() {
  const [sub, setSub] = useState<SubKey>("overview");
  const [editor, setEditor] = useState<EditorState | null>(null);
  const { data: entries = [] } = useMockCashflowEntries();

  const items = useMemo(() => SUB_TABS.map((s) => ({ key: s.key, label: s.label() })), []);

  const openCreate = useCallback(
    (transactionType: CashTransactionType) => setEditor({ transactionType, entry: null }),
    [],
  );
  const handleEdit = useCallback(
    (entry: CashflowEntryVm) => setEditor({ transactionType: entry.transactionType, entry }),
    [],
  );
  const closeEditor = useCallback(() => setEditor(null), []);
  const handleExport = useCallback(() => {
    const types = cashTransactionLabels();
    exportToExcel(entries.map((e) => toExportRow(e, types)), buildExportColumns(), "luan-chuyen-dong-tien");
  }, [entries]);

  const extra = sub === "overview" && (
    <Space wrap className="report-cashflow-v2-actions">
      <Button icon={<DownloadOutlined />} onClick={handleExport}>
        {t("Xuất Excel")}
      </Button>
      <Button icon={<SwapOutlined />} className="report-btn--blue" onClick={() => openCreate(CASH_TRANSACTION_TYPE.Transfer)}>
        {t("Luân chuyển")}
      </Button>
      <Button type="primary" icon={<VerticalAlignBottomOutlined />} className="report-btn--green" onClick={() => openCreate(CASH_TRANSACTION_TYPE.Deposit)}>
        {t("Nạp")}
      </Button>
      <Button danger icon={<VerticalAlignTopOutlined />} onClick={() => openCreate(CASH_TRANSACTION_TYPE.Withdraw)}>
        {t("Rút")}
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

      {sub === "overview" && <CashflowV2Overview onEdit={handleEdit} />}
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
