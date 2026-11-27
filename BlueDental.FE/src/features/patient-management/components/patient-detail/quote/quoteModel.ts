import type { PatientAdviseDto } from "@/features/treatment-management/api/consultingApi";
import { t } from "@/lib/i18n";
import { formatMoneyUnit } from "@/utils/format";

/**
 * The shapes the quote modal and its printed sheet work with — built once
 * from the ticked advise rows, never from the raw DTO in a component.
 */
export interface QuoteRow {
  id: string;
  service: string;
  quantity: number;
  unitPrice: number;
  clinicDiscount: number;
  voucherDiscount: number;
}

export interface QuoteClinic {
  name: string;
  address: string;
  phone: string;
  email: string;
  logoUrl: string | null;
}

export interface QuoteCustomer {
  code: string;
  name: string;
  phone: string;
  address: string;
  dateOfBirth: string;
}

export interface QuoteTotals {
  gross: number;
  discount: number;
  /** "Giảm giá bác sĩ" — the plan-level voucher on top of the row discounts. */
  extra: number;
  net: number;
}

export const money = (value: number) => formatMoneyUnit(value);

/** A deduction reads as one: "-3.500.000 đ", and a plain "0 đ" when there is none. */
export const minus = (value: number) => (value > 0 ? `-${money(value)}` : money(0));

/** The sheets print their summary labels in capitals, with a colon. */
export const sheetLabel = (key: string) => `${t(key).toLocaleUpperCase("vi")}:`;

export const rowDiscount = (row: QuoteRow) => row.clinicDiscount + row.voucherDiscount;

export const lineTotal = (row: QuoteRow) => row.quantity * row.unitPrice - rowDiscount(row);

export function toQuoteRow(row: PatientAdviseDto): QuoteRow {
  return {
    id: row.id,
    service: row.serviceName ?? "",
    quantity: row.quantity,
    unitPrice: row.price,
    // The server's discountAmount already counts the voucher share.
    clinicDiscount: row.discountAmount - (row.voucherDiscountAmount ?? 0),
    voucherDiscount: row.voucherDiscountAmount ?? 0,
  };
}

export function quoteTotals(rows: QuoteRow[], extra: number): QuoteTotals {
  const gross = rows.reduce((sum, row) => sum + row.quantity * row.unitPrice, 0);
  const discount = rows.reduce((sum, row) => sum + rowDiscount(row), 0);
  return { gross, discount, extra, net: Math.max(0, gross - discount - extra) };
}

const escapeHtml = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const DEFAULT_EXPLANATION_KEYS = [
  "Patient:Diagnosis:DefaultAdvice1",
  "Patient:Diagnosis:DefaultAdvice2",
] as const;

/**
 * The reference's stand-in explanation when a diagnosis carries no content —
 * the diagnosis print dialog of Chẩn đoán seeds its editor with it.
 */
export function defaultExplanationHtml(): string {
  return DEFAULT_EXPLANATION_KEYS.map((key) => `<p>${escapeHtml(t(key))}</p>`).join("");
}
