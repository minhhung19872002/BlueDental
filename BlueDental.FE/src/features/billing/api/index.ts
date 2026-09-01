import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/axios";
import { t } from "@/lib/i18n";

/** Matches BlueDental.Billing.InvoiceStatus. */
export const INVOICE_STATUS = {
  Draft: 1,
  Issued: 2,
  PartiallyPaid: 3,
  Paid: 4,
  Overdue: 5,
  Voided: 6,
  Refunded: 7,
} as const;
export type InvoiceStatus = (typeof INVOICE_STATUS)[keyof typeof INVOICE_STATUS];

export const invoiceStatusConfig = (): Record<
  InvoiceStatus,
  { label: string; color: string }
> => ({
  [INVOICE_STATUS.Draft]: { label: t("Nháp"), color: "#78819c" },
  [INVOICE_STATUS.Issued]: { label: t("Đã phát hành"), color: "#6366f1" },
  [INVOICE_STATUS.PartiallyPaid]: { label: t("Thu một phần"), color: "#d98b0f" },
  [INVOICE_STATUS.Paid]: { label: t("Đã thanh toán"), color: "#0e9f6e" },
  [INVOICE_STATUS.Overdue]: { label: t("Quá hạn"), color: "#e5484d" },
  [INVOICE_STATUS.Voided]: { label: t("Đã huỷ"), color: "#7d85a5" },
  [INVOICE_STATUS.Refunded]: { label: t("Đã hoàn tiền"), color: "#7c5ce0" },
});

/** Matches BlueDental.Billing.PaymentMethod. */
export const PAYMENT_METHOD = {
  Cash: 1,
  CreditCard: 2,
  DebitCard: 3,
  BankTransfer: 4,
  Insurance: 5,
  MobilePayment: 6,
  Voucher: 7,
} as const;
export type PaymentMethod = (typeof PAYMENT_METHOD)[keyof typeof PAYMENT_METHOD];

export const paymentMethodLabels = (): Record<PaymentMethod, string> => ({
  [PAYMENT_METHOD.Cash]: t("Tiền mặt"),
  [PAYMENT_METHOD.CreditCard]: t("Thẻ tín dụng"),
  [PAYMENT_METHOD.DebitCard]: t("Thẻ ghi nợ"),
  [PAYMENT_METHOD.BankTransfer]: t("Chuyển khoản"),
  [PAYMENT_METHOD.Insurance]: t("Bảo hiểm"),
  [PAYMENT_METHOD.MobilePayment]: t("Ví điện tử"),
  [PAYMENT_METHOD.Voucher]: t("Voucher"),
});

export interface InvoiceDto {
  id: string;
  invoiceNumber: string;
  patientId: string;
  patientName: string;
  branchId: string;
  subTotal: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
  paidAmount: number;
  balanceDue: number;
  currency: string;
  status: InvoiceStatus;
  issuedAt: string;
  dueAt: string;
}

export interface InvoiceListParams {
  skipCount?: number;
  maxResultCount?: number;
  branchId?: string;
  patientId?: string;
  status?: InvoiceStatus;
  filter?: string;
}

export interface RecordPaymentRequest {
  amount: number;
  currency: string;
  method: PaymentMethod;
  reference?: string;
}

const billingApi = {
  list: (
    params: InvoiceListParams,
  ): Promise<{ items: InvoiceDto[]; totalCount: number }> =>
    api.get("/v1/app/invoices", { params }).then((r) => r.data),

  get: (id: string): Promise<InvoiceDto> =>
    api.get(`/v1/app/invoices/${id}`).then((r) => r.data),

  recordPayment: (id: string, data: RecordPaymentRequest): Promise<InvoiceDto> =>
    api.post(`/v1/app/invoices/${id}/payment`, data).then((r) => r.data),

  void: (id: string, reason: string): Promise<void> =>
    api.post(`/v1/app/invoices/${id}/void`, { reason }).then(() => undefined),
};

export function useInvoiceList(params: InvoiceListParams = {}) {
  return useQuery({
    queryKey: ["invoices", params],
    queryFn: () => billingApi.list(params),
  });
}

export function useInvoice(id: string) {
  return useQuery({
    queryKey: ["invoices", id],
    queryFn: () => billingApi.get(id),
    enabled: Boolean(id),
  });
}

export function useRecordPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: RecordPaymentRequest }) =>
      billingApi.recordPayment(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["invoices"] }),
  });
}

export function useVoidInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      billingApi.void(id, reason),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["invoices"] }),
  });
}

export function usePatientInvoices(patientId: string) {
  return useQuery({
    queryKey: ["invoices", { patientId }],
    queryFn: () => billingApi.list({ patientId, maxResultCount: 50 }),
    enabled: Boolean(patientId),
    select: (d) => d.items,
  });
}
