import dayjs from "dayjs";
import { t } from "@/lib/i18n";
import { formatDate, formatMoneyUnit } from "@/utils/format";
import { paymentChannelLabels, type SalesEntryDto } from "../api/financeApi";
import type { VoucherLabels } from "./voucherLabels";

export interface PartyInfo {
  rows: { label: string; value: string }[];
}

interface Props {
  entry: SalesEntryDto;
  labels: VoucherLabels;
  clinic: PartyInfo;
  customer: PartyInfo;
}

function PartyBlock({ rows, className }: PartyInfo & { className: string }) {
  return (
    <section className={className}>
      {rows.map((row) => (
        <p key={row.label} className="report-print-line">
          <strong>{row.label}:</strong> {row.value}
        </p>
      ))}
    </section>
  );
}

/**
 * The A4 sheet the reference keeps off-screen (`fixed left-[-10000px]`) and
 * reveals only for `window.print()`: clinic block, centred PHIẾU CHI / PHIẾU
 * THU heading with the date and voucher number, customer block, the one-row
 * detail table, the total and the signature box.
 */
export function SalesEntryPrintSheet({ entry, labels, clinic, customer }: Props) {
  const date = dayjs(entry.entryDate);
  const channels = paymentChannelLabels();
  // The reference's sheet has no customer column: the customer sits in the header block.
  const cells = [
    formatDate(entry.entryDate),
    formatDate(entry.entryDate),
    entry.description || "—",
    entry.categoryName || "—",
    channels[entry.channel],
    entry.staffName || "—",
    formatMoneyUnit(entry.amount),
  ];
  const headers = [
    t("Ngày tạo"),
    labels.actualDate,
    labels.content,
    labels.category,
    t("Hình thức"),
    labels.staff,
    labels.amount,
  ];

  return (
    <div className="report-print-sheet" aria-hidden="true">
      <div className="report-print-page">
        <div className="report-print-header">
          <PartyBlock rows={clinic.rows} className="report-print-party" />
          <header className="report-print-heading">
            <h1>{labels.title}</h1>
            <p>{t("Ngày {0} tháng {1} năm {2}", date.format("D"), date.format("M"), date.format("YYYY"))}</p>
            <p>{t("Số: {0}", entry.code)}</p>
          </header>
          <PartyBlock rows={customer.rows} className="report-print-party report-print-party--end" />
        </div>

        <table className="report-print-table">
          <thead>
            <tr>
              {headers.map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              {cells.map((c, i) => (
                <td key={headers[i]} className={i === cells.length - 1 ? "report-print-cell--amount" : undefined}>
                  {c}
                </td>
              ))}
            </tr>
          </tbody>
        </table>

        <p className="report-print-total">
          <strong>{t("Tổng cộng")}:</strong> {formatMoneyUnit(entry.amount)}
        </p>

        <div className="report-print-signatures">
          <div className="report-print-signature">
            <strong>{t("Người lập phiếu")}</strong>
            <span>{t("(Ký, họ tên)")}</span>
            <span className="report-print-signature-name">{entry.staffName}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
