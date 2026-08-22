import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/axios";

export interface InvoiceDto {
  id: string;
  invoiceNumber: string;
  patientId: string;
  patientName: string;
  totalAmount: number;
  paidAmount: number;
  status: string;
  issuedDate: string;
  dueDate?: string;
}

export interface RecordPaymentRequest {
  amount: number;
  paymentMethod: string;
  note?: string;
}

const billingApi = {
  list: (params: { skipCount?: number; maxResultCount?: number; patientId?: string }): Promise<{ items: InvoiceDto[]; totalCount: number }> =>
    api.get("/v1/app/invoices", { params }).then((r) => r.data),

  get: (id: string): Promise<InvoiceDto> =>
    api.get(`/v1/app/invoices/${id}`).then((r) => r.data),

  recordPayment: (id: string, data: RecordPaymentRequest): Promise<InvoiceDto> =>
    api.post(`/v1/app/invoices/${id}/payment`, data).then((r) => r.data),

  void: (id: string, reason: string): Promise<void> =>
    api.post(`/v1/app/invoices/${id}/void`, { reason }).then(() => undefined),
};

export function useInvoiceList(params: { skipCount?: number; maxResultCount?: number; patientId?: string } = {}) {
  return useQuery({
    queryKey: ["invoices", params],
    queryFn: () => billingApi.list(params),
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
