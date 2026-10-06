import type { EInvoicePaymentMethod, EInvoiceSource } from "../api/eInvoiceApi";

export type InvoicePaymentMethod = EInvoicePaymentMethod;

/**
 * The tax select on a line. Each line opens on its service's "% thuế" (KCT is
 * -1, the rest are whole percents); "CX" (Chưa xuất) leaves it to the account's
 * default rate. One invoice still takes one rate — the server says so when the
 * ticked lines disagree.
 */
export type InvoiceTaxType = "CX" | "KCT" | "0" | "5" | "8" | "10";

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
