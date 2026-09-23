import { t } from "@/lib/i18n";
import type { InvoiceTemplate, InvoicePaymentMethod } from "./invoiceTypes";

export const INVOICE_TEMPLATES: InvoiceTemplate[] = [
  { id: "01GTKT0", label: "Mẫu 01GTKT0/001", symbol: "MAU_01GTK" },
  { id: "02GTTT0", label: "Mẫu 02GTTT0/001", symbol: "MAU_02GTT" },
];

export const invoicePaymentOptions = (): { value: InvoicePaymentMethod; label: string }[] => [
  { value: "cash", label: t("Treatment:Payment:Cash") },
  { value: "transfer", label: t("Treatment:Payment:Banking") },
];

export const TAX_TYPE_OPTIONS = (): { value: string; label: string }[] => [
  { value: "CX", label: t("Treatment:Invoice:NotIssued") },
  { value: "KCT", label: t("KCT") },
];

export const DEFAULT_TAX_TYPE = "CX";
export const DEFAULT_UNIT_KEY = "Răng";
export const DEFAULT_CURRENCY = "VND";
export const DEFAULT_EXCHANGE_RATE = 1;
