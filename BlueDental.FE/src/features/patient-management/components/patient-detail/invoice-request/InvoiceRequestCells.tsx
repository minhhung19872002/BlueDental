import { Link } from "react-router-dom";
import { t } from "@/lib/i18n";
import { formatDateTime } from "@/utils/format";
import {
  INVOICE_REQUEST_SOURCE,
  INVOICE_REQUEST_STATUS,
  type InvoiceRequestDto,
} from "../../../api/invoiceRequestApi";
import { InvoiceRequestStatusTag } from "./InvoiceRequestStatusTag";
import { describeDue } from "./invoiceRequestStatus";

/* The cells of the request table (buildInvoiceRequestColumns). */

/** The customer filled these in themselves; a staff request names its author. */
const CUSTOMER_SOURCE_LABEL: Partial<Record<InvoiceRequestDto["source"], string>> = {
  [INVOICE_REQUEST_SOURCE.CustomerQr]: "Patient:InvoiceRequest:ByCustomerQr",
  [INVOICE_REQUEST_SOURCE.SigningDevice]: "Patient:InvoiceRequest:ByCustomerIpad",
};

/** Whose request it is, opening their record on its Hóa đơn tab. */
export function CustomerCell({ row }: { row: InvoiceRequestDto }) {
  return (
    <div className="ir-cell">
      <Link to={`/patient/${row.patientId}?tab=invoice`}>
        <strong>{row.patientName}</strong>
      </Link>
      <small>{row.patientCode}</small>
    </div>
  );
}

export function TwoLines({ top, bottom }: { top: string; bottom?: string | null }) {
  return (
    <div className="ir-cell">
      <span>{top}</span>
      {bottom && <small>{bottom}</small>}
    </div>
  );
}

export function requesterOf(row: InvoiceRequestDto): string {
  const customerLabel = CUSTOMER_SOURCE_LABEL[row.source];
  return customerLabel ? t(customerLabel) : row.requesterName ?? "—";
}

/** "Công ty · MST 0101234567" or "Cá nhân". */
function buyerKind(row: InvoiceRequestDto): string {
  if (!row.isCompany) return t("Patient:InvoiceRequest:Personal");
  const company = t("Patient:InvoiceRequest:Company");
  return row.taxCode ? `${company} · ${t("Patient:InvoiceRequest:TaxCodeShort")} ${row.taxCode}` : company;
}

export function BuyerCell({ row }: { row: InvoiceRequestDto }) {
  return (
    <div className="ir-cell">
      <strong>{row.isCompany ? row.companyName ?? row.fullName : row.fullName}</strong>
      <small>{buyerKind(row)}</small>
      {/* The contact each kind asks: Email for Công ty, SĐT for Cá nhân (R-916). */}
      <small>{row.isCompany ? row.email : row.phone}</small>
    </div>
  );
}

export function StatusCell({ row }: { row: InvoiceRequestDto }) {
  const note = row.status === INVOICE_REQUEST_STATUS.Issued && row.invoiceNo
    ? t("Patient:InvoiceRequest:InvoiceNoShort", row.invoiceNo)
    : row.reason;
  return (
    <div className="ir-cell">
      <InvoiceRequestStatusTag status={row.status} />
      {note && <small className="ir-cell__note">{note}</small>}
    </div>
  );
}

export function DueCell({ row, now }: { row: InvoiceRequestDto; now: number }) {
  const due = describeDue(row, now);
  return (
    <div className="ir-cell">
      <span className={`ir-due ir-due--${due.tone}`}>{due.text}</span>
      {due.tone !== "none" && <small>{formatDateTime(row.dueAt)}</small>}
    </div>
  );
}
