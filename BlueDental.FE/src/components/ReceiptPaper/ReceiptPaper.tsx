import type { ReactNode } from "react";
import { t } from "@/lib/i18n";
import { formatDateTime, formatVND } from "@/utils/format";
import "./receipt-paper.css";

/** The clinic printed at the sheet's top: its logo and name. */
export interface ReceiptClinic {
  name: string;
  logoUrl: string;
}

/** What the PHIẾU THU says — the frozen content of PaymentReceiptContentDto. */
export interface ReceiptPaperData {
  code: string;
  content: {
    patientCode: string;
    payerName: string;
    planCode: string;
    /** `YYYY-MM-DD`, the Ngày thanh toán picked on the dialog. */
    paidOn: string;
    amount: number;
    amountInWords: string;
    remaining: number;
    remainingInWords: string;
    creatorName: string;
    lines: readonly { name: string; amount: number }[];
  };
}

/** The customer's drawing from the iPad, with the moment of "Hoàn tất ký". */
export interface ReceiptPaperSignature {
  dataUrl: string;
  signedAt: string;
}

interface Props {
  receipt: ReceiptPaperData;
  clinic: ReceiptClinic;
  signature?: ReceiptPaperSignature | null;
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

/** One signature box: who signs on top, the mark (or what it waits for), the name below. */
function SignBox({ role, name, children }: { role: string; name: string; children: ReactNode }) {
  return (
    <div className="rcpt-sign">
      <span className="rcpt-sign-role">{role}</span>
      <div className="rcpt-sign-mark">{children}</div>
      <span className="rcpt-sign-name">{name}</span>
    </div>
  );
}

function PayerMark({ signature }: { signature?: ReceiptPaperSignature | null }) {
  if (!signature) {
    return <span className="rcpt-sign-chip rcpt-sign-chip--waiting">{t("Receipt:Sheet:AwaitingCustomer")}</span>;
  }
  return (
    <>
      <img className="rcpt-sign-image" src={signature.dataUrl} alt={t("Receipt:Sheet:SignatureAlt")} />
      <span className="rcpt-sign-time">{t("Receipt:Sheet:SignedAt", formatDateTime(signature.signedAt))}</span>
    </>
  );
}

/**
 * The PHIẾU THU as the customer reads and signs it (P2610 mock), drawn from
 * the content frozen when it was written — a later rename of the patient or a
 * service never rewrites it. No Nợ / Có accounts: the BA took them off. The
 * accountant's page and the customer's iPad show the same sheet.
 */
export function ReceiptPaper({ receipt, clinic, signature }: Props) {
  const { content } = receipt;
  const paidOn = partsOf(content.paidOn);
  return (
    <article className="rcpt-sheet" aria-label={t("Treatment:PaymentReceipt:Title")}>
      <header className="rcpt-sheet-head">
        <div className="rcpt-sheet-heading">
          <div className="rcpt-sheet-brand">
            <img className="rcpt-sheet-logo" src={clinic.logoUrl} alt="" />
            <span className="rcpt-sheet-clinic">{clinic.name}</span>
          </div>
          <h2 className="rcpt-sheet-title">{t("Receipt:Sheet:Title")}</h2>
          <p className="rcpt-sheet-date">{t("Receipt:Sheet:Date", paidOn.day, paidOn.month, paidOn.year)}</p>
        </div>
        <p className="rcpt-sheet-number">{t("Receipt:Sheet:Number", receipt.code)}</p>
      </header>

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
        <SignBox role={t("Receipt:Sheet:PayerSign")} name={content.payerName}>
          <PayerMark signature={signature} />
        </SignBox>
        <SignBox role={t("Receipt:Sheet:AccountantSign")} name={content.creatorName}>
          <span className="rcpt-sign-chip">{t("Receipt:Sheet:NotSigned")}</span>
        </SignBox>
      </div>
    </article>
  );
}
