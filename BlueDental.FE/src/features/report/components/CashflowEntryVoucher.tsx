import { t } from "@/lib/i18n";
import { formatDate, formatMoneyUnit } from "@/utils/format";
import { moneyInWords } from "@/utils/moneyWords";
import {
  CASH_TRANSACTION_TYPE,
  cashHoldingLabels,
  formatCashMovement,
  type CashflowEntryDto,
  type CashTransactionType,
} from "../api/financeApi";

interface Props {
  entry: CashflowEntryDto;
}

interface VoucherRow {
  label: string;
  value: string;
  bold?: boolean;
}

const HEADINGS: Record<CashTransactionType, () => string> = {
  [CASH_TRANSACTION_TYPE.Deposit]: () => t("Report:Voucher:IncomeTitle"),
  [CASH_TRANSACTION_TYPE.Withdraw]: () => t("Report:Voucher:ExpenseTitle"),
  [CASH_TRANSACTION_TYPE.Transfer]: () => t("Report:Voucher:TransferTitle"),
};

const EMPTY = "—";

/** The reference's "Tài khoản": the holding the money sits in after the entry (or the transfer route). */
function accountLabel(entry: CashflowEntryDto): string {
  if (entry.fromHolding !== null && entry.toHolding !== null) {
    return formatCashMovement(entry.fromHolding, entry.toHolding);
  }
  const holding = entry.fromHolding ?? entry.toHolding;
  return holding === null ? EMPTY : cashHoldingLabels()[holding];
}

function creatorLabel(entry: CashflowEntryDto): string {
  return entry.createdByStaffName ?? t("Report:Unknown");
}

function RowList({ rows }: { rows: VoucherRow[] }) {
  return (
    <dl className="report-voucher-col">
      {rows.map((row) => (
        <div key={row.label} className={["report-voucher-row", row.bold && "report-voucher-row--bold"].filter(Boolean).join(" ")}>
          <dt>{row.label}</dt>
          <dd>{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * The reference's cash voucher body ("Chi tiết phiếu" on tab 4), shared by
 * the modal and its hidden print copy: heading by transaction type, two
 * columns of fields, the one-line table, the total and the signature block.
 */
export function CashflowEntryVoucher({ entry }: Props) {
  const account = accountLabel(entry);
  const amount = formatMoneyUnit(entry.amount);
  const left: VoucherRow[] = [
    { label: t("Report:EntryModal:ExecutionDate"), value: formatDate(entry.entryDate) },
    { label: t("Report:Column:CreatedDate"), value: formatDate(entry.creationTime) },
    { label: t("Report:Column:Creator"), value: creatorLabel(entry) },
    { label: t("Report:Voucher:Method"), value: formatCashMovement(entry.fromHolding, entry.toHolding) },
  ];
  const right: VoucherRow[] = [
    { label: t("Report:Voucher:Account"), value: account },
    { label: t("Report:Column:Amount"), value: amount, bold: true },
    { label: t("Report:Voucher:AmountInWords"), value: moneyInWords(entry.amount) },
    { label: t("Common:Note"), value: entry.note || EMPTY },
  ];

  return (
    <div className="report-voucher">
      <h1 className="report-voucher-heading">{HEADINGS[entry.transactionType]()}</h1>
      <div className="report-voucher-grid">
        <RowList rows={left} />
        <RowList rows={right} />
      </div>
      <table className="report-voucher-table">
        <thead>
          <tr>
            <th className="report-voucher-col--stt">{t("STT")}</th>
            <th>{t("Report:Column:Description")}</th>
            <th>{t("Report:Voucher:Account")}</th>
            <th className="report-voucher-cell--amount">{t("Report:Column:Amount")}</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>1</td>
            <td>{entry.note || EMPTY}</td>
            <td>{account}</td>
            <td className="report-voucher-cell--amount">{amount}</td>
          </tr>
        </tbody>
      </table>
      <p className="report-voucher-total">
        <span>{t("Report:Column:TotalMoney")}:</span>
        <span>{amount}</span>
      </p>
      <div className="report-voucher-signature">
        <p>{t("Report:Voucher:Creator")}</p>
        <p>{creatorLabel(entry)}</p>
      </div>
    </div>
  );
}
