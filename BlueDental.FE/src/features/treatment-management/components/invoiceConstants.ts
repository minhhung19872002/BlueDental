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
];

export const DEFAULT_TAX_TYPE: InvoiceTaxType = "CX";
/** The fields stay editable; the server refuses anything but VND at rate 1. */
export const DEFAULT_CURRENCY = "VND";
export const DEFAULT_EXCHANGE_RATE = 1;

/** -1 = KCT; null = the account's default rate (CX). */
export function vatRateOf(taxType: InvoiceTaxType): number | null {
  return taxType === "KCT" ? -1 : null;
}

export function vatRateLabel(rate: number): string {
  return rate < 0 ? t("Treatment:Invoice:TaxExempt") : `${rate}%`;
}

/** Same rounding as the server's Vnd.Round: whole đồng. */
export function taxOf(base: number, rate: number): number {
  return rate > 0 ? Math.round((base * rate) / 100) : 0;
}
