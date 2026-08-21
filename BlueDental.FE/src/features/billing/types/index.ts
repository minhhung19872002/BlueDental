// TODO: Define billing types (Invoice, Payment, InsuranceClaim).

export type InvoiceStatus = "draft" | "issued" | "paid" | "overdue" | "cancelled";

export interface InvoiceDto {
  id: string;
  invoiceNumber: string;
  patientId: string;
  patientName: string;
  appointmentId: string | null;
  status: InvoiceStatus;
  subtotal: number;
  discount: number;
  total: number;
  paidAmount: number;
  balance: number;
  issuedAt: string;
  dueAt: string | null;
}

export interface PaymentDto {
  id: string;
  invoiceId: string;
  amount: number;
  method: "cash" | "bank_transfer" | "card" | "insurance";
  paidAt: string;
  notes: string | null;
}
