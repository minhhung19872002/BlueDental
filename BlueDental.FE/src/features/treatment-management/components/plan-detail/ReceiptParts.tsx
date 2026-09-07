import type { ReactNode } from "react";
import { moneyText } from "../plan/planTypes";
import type { ReceiptTotal } from "./receiptView";

export interface ReceiptFact {
  label: string;
  value: ReactNode;
}

/** The "label: value" list under a section heading of "Chi tiết phiếu". */
export function ReceiptFacts({ facts }: { facts: ReceiptFact[] }) {
  return (
    <dl className="pdt-receipt-facts">
      {facts.map((fact) => (
        <div key={fact.label} className="pdt-receipt-fact">
          <dt>{fact.label}</dt>
          <dd>{fact.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** "Tổng thanh toán dịch vụ" — the money rows, the debt one in red. */
export function ReceiptTotals({ totals }: { totals: ReceiptTotal[] }) {
  return (
    <dl className="pdt-receipt-totals">
      {totals.map((total) => (
        <div key={total.label} className={total.tone === "debt" ? "pdt-receipt-total--debt" : undefined}>
          <dt>{total.label}</dt>
          <dd>{moneyText(total.value)}</dd>
        </div>
      ))}
    </dl>
  );
}
