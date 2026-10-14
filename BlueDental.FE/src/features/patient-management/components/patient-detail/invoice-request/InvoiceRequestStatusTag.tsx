import { t } from "@/lib/i18n";
import type { InvoiceRequestStatus } from "../../../api/invoiceRequestApi";
import { INVOICE_REQUEST_STATUS_CONFIG } from "./invoiceRequestStatus";

export function InvoiceRequestStatusTag({ status }: { status: InvoiceRequestStatus }) {
  const config = INVOICE_REQUEST_STATUS_CONFIG[status];
  return <span className={`ir-status ir-status--${config.tone}`}>{t(config.labelKey)}</span>;
}
