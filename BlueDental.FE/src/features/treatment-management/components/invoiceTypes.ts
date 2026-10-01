import type { EInvoicePaymentMethod, EInvoiceSource } from "../api/eInvoiceApi";

export type InvoicePaymentMethod = EInvoicePaymentMethod;

/**
 * The tax select on a line, as the original offers it: "CX" takes the
 * account's default rate, "KCT" is not subject to VAT (-1). An invoice carries
 * one rate (the provider refuses mixed ones), so picking it on a line sets it
 * on every line.
 */
export type InvoiceTaxType = "CX" | "KCT";

export interface InvoiceServiceRow {
  key: string;
  stt: number;
  code: string;
  serviceName: string;
  taxType: InvoiceTaxType;
  unit: string;
  quantity: number;
  unitPrice: number;
  taxBasePrice: number;
  /** What the "% thuế" column prints: "8%", "KCT"… */
  taxPercent: string;
  taxAmount: number;
  totalAfterTax: number;
  selected: boolean;
}

export interface InvoiceModalProps {
  open: boolean;
  /** One receipt, or the whole slip ("Hóa đơn" on the slip). */
  source: EInvoiceSource;
  onClose: () => void;
}
