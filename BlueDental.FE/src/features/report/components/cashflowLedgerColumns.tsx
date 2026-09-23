import { Button, Space, Tooltip, type TableColumnsType } from "antd";
import { DeleteOutlined, EditOutlined, EyeOutlined } from "@ant-design/icons";
import { t } from "@/lib/i18n";
import { formatDate, formatMoneyUnit } from "@/utils/format";
import {
  CASH_HOLDING,
  CASH_TRANSACTION_TYPE,
  cashHoldingLabels,
  cashTransactionLabels,
  type CashflowEntryDto,
  type CashHolding,
} from "../api/financeApi";

/** Reference badge tone per holding: cash green, banking gold, card violet, a transfer arrow on ink. */
const HOLDING_BADGE_CLASS: Record<CashHolding, string> = {
  [CASH_HOLDING.Cash]: "report-method-badge--cash",
  [CASH_HOLDING.Bank]: "report-method-badge--bank",
  [CASH_HOLDING.Card]: "report-method-badge--card",
  [CASH_HOLDING.CustomerPrepaid]: "report-method-badge--transfer",
};

function MethodBadge({ row }: { row: CashflowEntryDto }) {
  const labels = cashHoldingLabels();
  if (row.fromHolding !== null && row.toHolding !== null) {
    return (
      <span className="report-method-badge report-method-badge--transfer">
        {labels[row.fromHolding]} → {labels[row.toHolding]}
      </span>
    );
  }
  const holding = row.fromHolding ?? row.toHolding;
  if (holding === null) return <>—</>;
  return <span className={`report-method-badge ${HOLDING_BADGE_CLASS[holding]}`}>{labels[holding]}</span>;
}

/** "+" green for money coming in, "-" red for money leaving; a transfer is neither. */
function SignedAmount({ row }: { row: CashflowEntryDto }) {
  const isWithdraw = row.transactionType === CASH_TRANSACTION_TYPE.Withdraw;
  const isDeposit = row.transactionType === CASH_TRANSACTION_TYPE.Deposit;
  const tone = isWithdraw ? "report-money--red" : isDeposit ? "report-money--green" : "report-money--ink";
  const sign = isWithdraw ? "-" : isDeposit ? "+" : "";
  return (
    <span className={`report-money report-money--bold ${tone}`}>
      {sign}
      {formatMoneyUnit(row.amount)}
    </span>
  );
}

/** The reference paints the pill with the category's colour and falls back to slate. */
function CategoryPill({ row }: { row: CashflowEntryDto }) {
  if (!row.categoryName) return <>—</>;
  const style = row.categoryColor ? ({ "--pill-color": row.categoryColor } as React.CSSProperties) : undefined;
  return (
    <span className="report-category-pill" style={style}>
      {row.categoryName}
    </span>
  );
}

export interface LedgerActions {
  onView: (entry: CashflowEntryDto) => void;
  onEdit: (entry: CashflowEntryDto) => void;
  onDelete: (entry: CashflowEntryDto) => void;
  canEdit: boolean;
  canDelete: boolean;
}

function RowActions({ row, actions }: { row: CashflowEntryDto; actions: LedgerActions }) {
  return (
    <Space size={4}>
      <Tooltip title={t("Report:Action:ViewDetail")}>
        <Button size="small" type="text" icon={<EyeOutlined />} aria-label={t("Report:Action:ViewDetail")} onClick={() => actions.onView(row)} />
      </Tooltip>
      {actions.canEdit && (
        <Tooltip title={t("Common:Edit")}>
          <Button size="small" type="text" icon={<EditOutlined />} aria-label={t("Common:Edit")} onClick={() => actions.onEdit(row)} />
        </Tooltip>
      )}
      {actions.canDelete && (
        <Tooltip title={t("Common:Cancel")}>
          <Button size="small" type="text" danger icon={<DeleteOutlined />} aria-label={t("Common:Cancel")} onClick={() => actions.onDelete(row)} />
        </Tooltip>
      )}
    </Space>
  );
}

/** The tab-4 ledger: the reference's columns, widths and an eye / pencil / bin per row. */
export function buildLedgerColumns(actions: LedgerActions): TableColumnsType<CashflowEntryDto> {
  const types = cashTransactionLabels();
  return [
    { title: t("Report:Column:Date"), dataIndex: "entryDate", width: 130, render: (v: string) => formatDate(v) },
    {
      title: t("Report:Column:TransactionType"),
      dataIndex: "transactionType",
      width: 150,
      render: (v: CashflowEntryDto["transactionType"]) => <span className="report-type-label">{types[v]}</span>,
    },
    { title: t("Report:Column:PaymentMethod"), key: "holding", width: 170, render: (_: unknown, row) => <MethodBadge row={row} /> },
    { title: t("Report:Column:Category"), key: "category", width: 150, render: (_: unknown, row) => <CategoryPill row={row} /> },
    { title: t("Report:Column:Amount"), key: "amount", width: 150, render: (_: unknown, row) => <SignedAmount row={row} /> },
    { title: t("Report:Column:Creator"), dataIndex: "createdByStaffName", width: 150, render: (v: string | null) => v ?? t("Report:Unknown") },
    { title: t("Common:Note"), dataIndex: "note", width: 200, render: (v: string | null) => v || "—" },
    {
      title: t("Common:Actions"),
      key: "actions",
      width: 110,
      align: "center",
      fixed: "right",
      render: (_: unknown, row) => <RowActions row={row} actions={actions} />,
    },
  ];
}
