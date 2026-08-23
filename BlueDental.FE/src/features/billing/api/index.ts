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

// ─── Insurance Claims ────────────────────────────────────────────────────────

export type InsuranceClaimStatus = "Submitted" | "UnderReview" | "Approved" | "Rejected";

export interface InsuranceClaimDto {
  id: string;
  claimCode: string;
  patientId: string;
  patientName: string;
  insurancePlanName: string;
  claimedAmount: number;
  approvedAmount: number | null;
  status: InsuranceClaimStatus;
  submittedAt: string;
  resolvedAt: string | null;
  rejectionReason: string | null;
}

export interface CreateInsuranceClaimRequest {
  patientId: string;
  invoiceId: string;
  insurancePlanId: string;
  claimedAmount: number;
  notes?: string;
}

const insuranceClaimApi = {
  list: (params: {
    skipCount?: number;
    maxResultCount?: number;
    patientId?: string;
    status?: InsuranceClaimStatus;
  }): Promise<{ items: InsuranceClaimDto[]; totalCount: number }> =>
    api.get("/v1/app/insurance-claims", { params }).then((r) => r.data),

  create: (data: CreateInsuranceClaimRequest): Promise<InsuranceClaimDto> =>
    api.post("/v1/app/insurance-claims", data).then((r) => r.data),

  submit: (id: string): Promise<InsuranceClaimDto> =>
    api.post(`/v1/app/insurance-claims/${id}/submit`).then((r) => r.data),

  approve: (id: string, approvedAmount: number): Promise<InsuranceClaimDto> =>
    api.post(`/v1/app/insurance-claims/${id}/approve`, { approvedAmount }).then((r) => r.data),

  reject: (id: string, reason: string): Promise<InsuranceClaimDto> =>
    api.post(`/v1/app/insurance-claims/${id}/reject`, { reason }).then((r) => r.data),
};

export const insuranceClaimKeys = {
  all: ["insurance-claims"] as const,
  lists: () => [...insuranceClaimKeys.all, "list"] as const,
  list: (params: { patientId?: string; status?: InsuranceClaimStatus }) =>
    [...insuranceClaimKeys.lists(), params] as const,
};

export function useInsuranceClaimList(params: {
  skipCount?: number;
  maxResultCount?: number;
  patientId?: string;
  status?: InsuranceClaimStatus;
} = {}) {
  return useQuery({
    queryKey: insuranceClaimKeys.list({ patientId: params.patientId, status: params.status }),
    queryFn: () => insuranceClaimApi.list(params),
  });
}

export function usePatientInsuranceClaims(patientId: string) {
  return useQuery({
    queryKey: insuranceClaimKeys.list({ patientId }),
    queryFn: () => insuranceClaimApi.list({ patientId, maxResultCount: 50 }),
    enabled: Boolean(patientId),
    select: (d) => d.items,
  });
}

export function useCreateInsuranceClaim() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateInsuranceClaimRequest) => insuranceClaimApi.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: insuranceClaimKeys.all }),
  });
}

export function useSubmitInsuranceClaim() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => insuranceClaimApi.submit(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: insuranceClaimKeys.all }),
  });
}

export function useApproveInsuranceClaim() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, approvedAmount }: { id: string; approvedAmount: number }) =>
      insuranceClaimApi.approve(id, approvedAmount),
    onSuccess: () => qc.invalidateQueries({ queryKey: insuranceClaimKeys.all }),
  });
}

export function useRejectInsuranceClaim() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      insuranceClaimApi.reject(id, reason),
    onSuccess: () => qc.invalidateQueries({ queryKey: insuranceClaimKeys.all }),
  });
}
