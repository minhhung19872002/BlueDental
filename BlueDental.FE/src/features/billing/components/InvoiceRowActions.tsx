import { Button } from "antd";
import { INVOICE_STATUS, type InvoiceDto } from "../api";
import { t } from "@/lib/i18n";

interface Props {
  invoice: InvoiceDto;
  canCollect: boolean;
  canUpdate: boolean;
  onCollect: (invoice: InvoiceDto) => void;
  onIssue: (invoice: InvoiceDto) => void;
  onVoid: (invoice: InvoiceDto) => void;
}

/** An invoice that is still owed money and may still be collected against. */
function isCollectable(row: InvoiceDto): boolean {
  return (
    row.balanceDue > 0 &&
    row.status !== INVOICE_STATUS.Voided &&
    row.status !== INVOICE_STATUS.Draft &&
    row.status !== INVOICE_STATUS.Refunded
  );
}

/** Paid, voided and refunded invoices are closed; anything else may still be voided. */
const VOIDABLE: ReadonlySet<number> = new Set([
  INVOICE_STATUS.Draft,
  INVOICE_STATUS.Issued,
  INVOICE_STATUS.PartiallyPaid,
  INVOICE_STATUS.Overdue,
]);

/** Draft → Issued → collect; Void with a reason while not settled. */
export function InvoiceRowActions({ invoice, canCollect, canUpdate, onCollect, onIssue, onVoid }: Props) {
  const isDraft = invoice.status === INVOICE_STATUS.Draft;
  return (
    <div className="billing-row-actions">
      {canUpdate && isDraft && (
        <Button size="small" onClick={() => onIssue(invoice)}>
          {t("Billing:Issue")}
        </Button>
      )}
      {canCollect && !isDraft && (
        <Button size="small" type="primary" disabled={!isCollectable(invoice)} onClick={() => onCollect(invoice)}>
          {t("Billing:CollectPayment")}
        </Button>
      )}
      {canUpdate && VOIDABLE.has(invoice.status) && (
        <Button size="small" danger onClick={() => onVoid(invoice)}>
          {t("Billing:Void")}
        </Button>
      )}
    </div>
  );
}
