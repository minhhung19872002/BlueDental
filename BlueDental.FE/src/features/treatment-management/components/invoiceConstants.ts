import { t } from "@/lib/i18n";
import { EINVOICE_PAYMENT_METHOD } from "../api/eInvoiceApi";
import type { InvoicePaymentMethod, InvoiceTaxType } from "./invoiceTypes";

export const invoicePaymentOptions = (): { value: InvoicePaymentMethod; label: string }[] => [
  { value: EINVOICE_PAYMENT_METHOD.Cash, label: t("Treatment:Payment:Cash") },
  { value: EINVOICE_PAYMENT_METHOD.Transfer, label: t("Treatment:Payment:BankTransfer") },
];

export const TAX_TYPE_OPTIONS = (): { value: InvoiceTaxType; label: string }[] => [
  { value: "CX", label: t("Treatment:Invoice:NotIssued") },
  { value: "KCT", label: t("Treatment:Invoice:TaxExempt") },
  { value: "0", label: "0%" },
  { value: "5", label: "5%" },
  { value: "8", label: "8%" },
  { value: "10", label: "10%" },
];

/** The fields stay editable; the server refuses anything but VND at rate 1. */
export const DEFAULT_CURRENCY = "VND";
export const DEFAULT_EXCHANGE_RATE = 1;

/** -1 = KCT; null = the account's default rate (CX); otherwise the percent. */
export function vatRateOf(taxType: InvoiceTaxType): number | null {
  if (taxType === "CX") return null;
  return taxType === "KCT" ? -1 : Number(taxType);
}

const RATE_TAX_TYPES: Record<number, InvoiceTaxType> = { [-1]: "KCT", 0: "0", 5: "5", 8: "8", 10: "10" };

/** The select value a server line's rate opens on; an unknown rate falls back to CX. */
export function taxTypeOf(vatRate: number): InvoiceTaxType {
  return RATE_TAX_TYPES[vatRate] ?? "CX";
}

export function vatRateLabel(rate: number): string {
  return rate < 0 ? t("Treatment:Invoice:TaxExempt") : `${rate}%`;
}

/** Same rounding as the server's Vnd.Round: whole đồng. */
export function taxOf(base: number, rate: number): number {
  return rate > 0 ? Math.round((base * rate) / 100) : 0;
}
