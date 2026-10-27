import type { ReactNode } from "react";
import { t } from "@/lib/i18n";
import { formatDateTime, formatVND } from "@/utils/format";
import { RECEIPT_SIGN_MODE, type PaymentReceiptDto, type ReceiptSignMode } from "../../../api/paymentReceiptApi";
import { ledgerMethodLabels } from "../../../api/paymentLedgerApi";

/** What "Chữ ký" says: the customer signed before any export, then how the clinic did. */
const SIGNATURE_KEYS: Record<ReceiptSignMode, string> = {
  [RECEIPT_SIGN_MODE.Unsigned]: "Receipt:Cancel:SignedUnsigned",
  [RECEIPT_SIGN_MODE.Digital]: "Receipt:Cancel:SignedDigital",
};

/**
 * "Phiếu thu gốc" (P2610 mock): the receipt being cancelled, as it was
 * exported. Hóa đơn is left out — the receipt read does not carry it, and a
 * signed e-invoice refuses the cancel on the server anyway.
 */
export function ReceiptCancelSummary({ receipt }: { receipt: PaymentReceiptDto }) {
  const { content } = receipt;
  const rows: [string, ReactNode][] = [
    ["Receipt:Cancel:Code", receipt.code],
    ["Receipt:Cancel:Payer", <strong key="payer">{content.payerName}</strong>],
    ["Receipt:Cancel:Amount", <strong key="amount" className="rcpt-cancel-amount">{formatVND(content.amount)}</strong>],
    ["Receipt:Cancel:Method", ledgerMethodLabels()[content.method]],
    ["Receipt:Cancel:IssuedAt", receipt.issuedAt ? formatDateTime(receipt.issuedAt) : "—"],
    ["Receipt:Cancel:Signature", receipt.signMode ? t(SIGNATURE_KEYS[receipt.signMode]) : "—"],
  ];
  return (
    <section className="rcpt-cancel-card" aria-labelledby="rcpt-cancel-original">
      <h2 id="rcpt-cancel-original" className="rcpt-cancel-card-title">
        {t("Receipt:Cancel:Original")}
      </h2>
      <dl className="rcpt-cancel-facts">
        {rows.map(([label, value]) => (
          <div key={label} className="rcpt-cancel-fact">
            <dt>{t(label)}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
