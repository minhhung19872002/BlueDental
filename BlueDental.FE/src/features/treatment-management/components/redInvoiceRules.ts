import { t } from "@/lib/i18n";

/** The buyer fields "Xuất hóa đơn đỏ" makes mandatory (BA); the server refuses with EInvoicing:0017. */
export type RedInvoiceField = "customerName" | "taxCode" | "phone" | "email";

export type RedInvoiceErrors = Partial<Record<RedInvoiceField, string>>;

export const RED_INVOICE_ERROR_KEYS: Record<RedInvoiceField, string> = {
  customerName: "Treatment:Invoice:CustomerNameRequired",
  taxCode: "Treatment:Invoice:TaxCodeRequired",
  phone: "Treatment:Invoice:PhoneRequired",
  email: "Treatment:Invoice:EmailRequired",
};

const FIELDS: readonly RedInvoiceField[] = ["customerName", "taxCode", "phone", "email"];

/** One message per blank field, for the inline error under it. */
export function redInvoiceErrors(missing: readonly RedInvoiceField[]): RedInvoiceErrors {
  const errors: RedInvoiceErrors = {};
  for (const field of missing) errors[field] = t(RED_INVOICE_ERROR_KEYS[field]);
  return errors;
}

/** The mandatory fields still blank, in form order. */
export function missingRedInvoiceFields(values: Record<RedInvoiceField, string>): RedInvoiceField[] {
  return FIELDS.filter((field) => values[field].trim() === "");
}
