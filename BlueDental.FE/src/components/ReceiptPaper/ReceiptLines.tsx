import { t } from "@/lib/i18n";
import { formatVND } from "@/utils/format";

/** One service the receipt pays, under its "Tên trên phiếu", and what this receipt lets off it (P2910). */
export interface ReceiptPaperLine {
  name: string;
  amount: number;
  /** Giảm giá thu ngân; absent or 0 on a sheet frozen before P2910. */
  cashierDiscount?: number;
  voucherShare?: number;
}

/** "Giảm giá −X · Voucher −Y" under a line, as the payment dialog's preview promised the customer. */
function reliefNote({ cashierDiscount = 0, voucherShare = 0 }: ReceiptPaperLine): string | null {
  const parts = [
    cashierDiscount > 0 ? t("Receipt:Sheet:LineDiscount", formatVND(cashierDiscount)) : null,
    voucherShare > 0 ? t("Receipt:Sheet:LineVoucher", formatVND(voucherShare)) : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : null;
}

/** The sheet's services: name over its relief note | what this receipt collects on it. */
export function ReceiptLines({ lines }: { lines: readonly ReceiptPaperLine[] }) {
  if (lines.length === 0) return null;
  return (
    <table className="rcpt-lines">
      <thead>
        <tr>
          <th scope="col">{t("Receipt:Sheet:Service")}</th>
          <th scope="col" className="rcpt-lines-money">
            {t("Receipt:Sheet:LineAmount")}
          </th>
        </tr>
      </thead>
      <tbody>
        {lines.map((line, index) => {
          const note = reliefNote(line);
          return (
            <tr key={`${index}-${line.name}`}>
              <td>
                {line.name}
                {note && <small className="rcpt-lines-note">{note}</small>}
              </td>
              <td className="rcpt-lines-money">{formatVND(line.amount)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
