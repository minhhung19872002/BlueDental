import type { ReactNode } from "react";
import { t } from "@/lib/i18n";
import { formatVND } from "@/utils/format";
import type { PaymentReceiptDto } from "../../api/paymentReceiptApi";

/** The clinic printed at the sheet's top: its logo and name. */
export interface ReceiptClinic {
  name: string;
  logoUrl: string;
}

interface Props {
  receipt: PaymentReceiptDto;
  clinic: ReceiptClinic;
}

/** "2026-10-27" → its day, month and year, as the paper reads them. */
function partsOf(isoDay: string): { day: number; month: number; year: number; text: string } {
  const [year, month, day] = isoDay.split("-").map(Number);
  const text = `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}/${year}`;
  return { day, month, year, text };
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rcpt-row">
      <span className="rcpt-row-label">{label}</span>
      <span className="rcpt-row-value">{children}</span>
    </div>
  );
}

/**
 * The PHIẾU THU as the customer will read and sign it (P2610 mock), drawn from
 * the content frozen when it was written — a later rename of the patient or a
 * service never rewrites it. No Nợ / Có accounts: the BA took them off.
 */
export function ReceiptSheet({ receipt, clinic }: Props) {
  const { content } = receipt;
  const paidOn = partsOf(content.paidOn);
  return (
    <article className="rcpt-sheet" aria-label={t("Treatment:PaymentReceipt:Title")}>
      <div className="rcpt-sheet-brand">
        <img className="rcpt-sheet-logo" src={clinic.logoUrl} alt="" />
        <span className="rcpt-sheet-clinic">{clinic.name}</span>
      </div>
      <h2 className="rcpt-sheet-title">{t("Receipt:Sheet:Title")}</h2>
      <p className="rcpt-sheet-date">{t("Receipt:Sheet:Date", paidOn.day, paidOn.month, paidOn.year)}</p>
      <p className="rcpt-sheet-number">{t("Receipt:Sheet:Number", receipt.code)}</p>

      <div className="rcpt-rows">
        <Row label={t("Receipt:Sheet:Payer")}>
          <strong>{content.payerName}</strong> ({content.patientCode})
        </Row>
        <Row label={t("Receipt:Sheet:Reason")}>{t("Receipt:Sheet:ReasonText", paidOn.text, content.planCode)}</Row>
        <Row label={t("Receipt:Sheet:Amount")}>
          <strong className="rcpt-amount">{formatVND(content.amount)}</strong>
        </Row>
        <Row label={t("Receipt:Sheet:InWords")}>
          <em>{content.amountInWords}</em>
        </Row>
        <Row label={t("Receipt:Sheet:Remaining")}>
          {formatVND(content.remaining)} <em className="rcpt-words">({content.remainingInWords})</em>
        </Row>
      </div>

      {content.lines.length > 0 && (
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
            {content.lines.map((line, index) => (
              <tr key={`${index}-${line.name}`}>
                <td>{line.name}</td>
                <td className="rcpt-lines-money">{formatVND(line.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="rcpt-signs">
        <div className="rcpt-sign">
          <span className="rcpt-sign-role">{t("Receipt:Sheet:PayerSign")}</span>
          <span className="rcpt-sign-box">{t("Receipt:Sheet:AwaitingCustomer")}</span>
        </div>
        <div className="rcpt-sign">
          <span className="rcpt-sign-role">{t("Receipt:Sheet:AccountantSign")}</span>
          <span className="rcpt-sign-box">{t("Receipt:Sheet:NotSigned")}</span>
          <span className="rcpt-sign-name">{content.creatorName}</span>
        </div>
      </div>
    </article>
  );
}
