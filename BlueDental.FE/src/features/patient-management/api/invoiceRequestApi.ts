import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/axios";
import type { QueryEntity } from "@/lib/queryEntities";

// ── DTO mirror (BlueDental.Application.Contracts/EInvoicing) ────────────────

/** Where a "Yêu cầu xuất HĐ" stands with the accountant. */
export const INVOICE_REQUEST_STATUS = {
  Pending: 1,
  Processing: 2,
  NeedsInfo: 3,
  Issued: 4,
  Cancelled: 5,
} as const;

export type InvoiceRequestStatus =
  (typeof INVOICE_REQUEST_STATUS)[keyof typeof INVOICE_REQUEST_STATUS];

/** Who filled the request in: the customer by QR, or staff. */
export const INVOICE_REQUEST_SOURCE = { CustomerQr: 1, Staff: 2 } as const;

export type InvoiceRequestSource =
  (typeof INVOICE_REQUEST_SOURCE)[keyof typeof INVOICE_REQUEST_SOURCE];

export interface InvoiceRequestDto {
  id: string;
  clinicBranchId: string;
  patientId: string;
  patientPaymentId: string;
  treatmentPlanId: string | null;
  code: string;
  source: InvoiceRequestSource;
  requesterName: string | null;
  paymentCode: string;
  fullName: string;
  birthYear: number | null;
  phone: string;
  nationalId: string | null;
  personalAddress: string | null;
  companyName: string | null;
  taxCode: string | null;
  companyAddress: string | null;
  email: string;
  wantsPaperInvoice: boolean | null;
  isCompany: boolean;
  serviceName: string;
  amount: number;
  requestedAt: string;
  dueAt: string;
  status: InvoiceRequestStatus;
  assigneeId: string | null;
  assigneeName: string | null;
  completedAt: string | null;
  invoiceNo: string | null;
  reason: string | null;
}

export interface InvoiceRequestStatsDto {
  total: number;
  open: number;
  pending: number;
  processing: number;
  needsInfo: number;
  issued: number;
  cancelled: number;
  overdue: number;
}

export interface InvoiceRequestPaymentOptionDto {
  patientPaymentId: string;
  treatmentPlanId: string | null;
  paymentCode: string;
  paidAt: string;
  amount: number;
  serviceName: string;
}

export interface InvoiceRequestDraftDto {
  patientPaymentId: string;
  paymentCode: string;
  serviceName: string;
  amount: number;
  fullName: string;
  birthYear: number | null;
  phone: string | null;
  nationalId: string | null;
  personalAddress: string | null;
  email: string | null;
}

export interface InvoiceRequestLinkDto {
  url: string;
  expiresAt: string;
  submittedAt: string | null;
}

/** The THÔNG TIN XUẤT HÓA ĐƠN fields; the server checks them again. */
export interface InvoiceRequestFormValues {
  /** Loại hóa đơn: Công ty (true) or Cá nhân. */
  isCompany: boolean;
  /** Cá nhân only; Công ty keeps the patient's name. */
  fullName: string | null;
  birthYear: number | null;
  phone: string | null;
  nationalId: string | null;
  personalAddress: string | null;
  companyName: string | null;
  taxCode: string | null;
  companyAddress: string | null;
  email: string | null;
  wantsPaperInvoice: boolean | null;
}

export interface InvoiceRequestListParams {
  patientId: string;
  status?: InvoiceRequestStatus;
  openOnly?: boolean;
  skipCount: number;
  maxResultCount: number;
}

interface PagedResult<T> {
  items: T[];
  totalCount: number;
}

// ── HTTP ────────────────────────────────────────────────────────────────────

const BASE = "/v1/app/invoice-requests";

const invoiceRequestHttp = {
  list: (params: InvoiceRequestListParams) =>
    api.get<PagedResult<InvoiceRequestDto>>(BASE, { params }).then((r) => r.data),
  stats: (patientId: string) =>
    api.get<InvoiceRequestStatsDto>(`${BASE}/stats`, { params: { patientId } }).then((r) => r.data),
  paymentOptions: (patientId: string) =>
    api
      .get<InvoiceRequestPaymentOptionDto[]>(`${BASE}/payment-options/${patientId}`)
      .then((r) => r.data),
  draft: (patientPaymentId: string) =>
    api.get<InvoiceRequestDraftDto>(`${BASE}/draft/${patientPaymentId}`).then((r) => r.data),
  link: (patientPaymentId: string) =>
    api.post<InvoiceRequestLinkDto>(`${BASE}/links/${patientPaymentId}`).then((r) => r.data),
  create: (body: InvoiceRequestFormValues & { patientPaymentId: string }) =>
    api.post<InvoiceRequestDto>(BASE, body).then((r) => r.data),
  update: ({ id, ...body }: InvoiceRequestFormValues & { id: string }) =>
    api.put<InvoiceRequestDto>(`${BASE}/${id}`, body).then((r) => r.data),
  start: (id: string) => api.post<InvoiceRequestDto>(`${BASE}/${id}/start`).then((r) => r.data),
  needsInfo: ({ id, reason }: { id: string; reason: string }) =>
    api.post<InvoiceRequestDto>(`${BASE}/${id}/needs-info`, { reason }).then((r) => r.data),
  complete: ({ id, invoiceNo }: { id: string; invoiceNo: string }) =>
    api.post<InvoiceRequestDto>(`${BASE}/${id}/complete`, { invoiceNo }).then((r) => r.data),
  cancel: ({ id, reason }: { id: string; reason: string }) =>
    api.post<InvoiceRequestDto>(`${BASE}/${id}/cancel`, { reason }).then((r) => r.data),
};

// ── Queries ─────────────────────────────────────────────────────────────────

export const invoiceRequestKeys = {
  all: ["invoice-requests"] as const,
  list: (params: InvoiceRequestListParams) => [...invoiceRequestKeys.all, "list", params] as const,
  stats: (patientId: string) => [...invoiceRequestKeys.all, "stats", patientId] as const,
  paymentOptions: (patientId: string) =>
    [...invoiceRequestKeys.all, "payment-options", patientId] as const,
  draft: (patientPaymentId: string) => [...invoiceRequestKeys.all, "draft", patientPaymentId] as const,
};

export function useInvoiceRequests(params: InvoiceRequestListParams) {
  return useQuery({
    queryKey: invoiceRequestKeys.list(params),
    queryFn: () => invoiceRequestHttp.list(params),
    enabled: Boolean(params.patientId),
    // A chip or a page turn narrows the table in place rather than blanking it.
    placeholderData: keepPreviousData,
  });
}

/** Counts behind the chips, the banner and the badge on the Hóa đơn tab. */
export function useInvoiceRequestStats(patientId: string, enabled = true) {
  return useQuery({
    queryKey: invoiceRequestKeys.stats(patientId),
    queryFn: () => invoiceRequestHttp.stats(patientId),
    enabled: enabled && Boolean(patientId),
  });
}

/** Receipts the create dialog may pick: payments with no live request. */
export function useInvoiceRequestPaymentOptions(patientId: string, enabled: boolean) {
  return useQuery({
    queryKey: invoiceRequestKeys.paymentOptions(patientId),
    queryFn: () => invoiceRequestHttp.paymentOptions(patientId),
    enabled: enabled && Boolean(patientId),
    staleTime: 0,
  });
}

/** The form prefilled from the patient and the picked receipt. */
export function useInvoiceRequestDraft(patientPaymentId: string | null) {
  return useQuery({
    queryKey: invoiceRequestKeys.draft(patientPaymentId ?? ""),
    queryFn: () => invoiceRequestHttp.draft(patientPaymentId ?? ""),
    enabled: Boolean(patientPaymentId),
    staleTime: 0,
  });
}

// ── Mutations ───────────────────────────────────────────────────────────────

const INVALIDATES: readonly QueryEntity[] = ["invoiceRequest"];

export function useCreateInvoiceRequest() {
  return useMutation({ mutationFn: invoiceRequestHttp.create, meta: { invalidates: INVALIDATES } });
}

export function useUpdateInvoiceRequest() {
  return useMutation({ mutationFn: invoiceRequestHttp.update, meta: { invalidates: INVALIDATES } });
}

export function useStartInvoiceRequest() {
  return useMutation({ mutationFn: invoiceRequestHttp.start, meta: { invalidates: INVALIDATES } });
}

export function useNeedsInfoInvoiceRequest() {
  return useMutation({ mutationFn: invoiceRequestHttp.needsInfo, meta: { invalidates: INVALIDATES } });
}

export function useCompleteInvoiceRequest() {
  return useMutation({ mutationFn: invoiceRequestHttp.complete, meta: { invalidates: INVALIDATES } });
}

export function useCancelInvoiceRequest() {
  return useMutation({ mutationFn: invoiceRequestHttp.cancel, meta: { invalidates: INVALIDATES } });
}

/** The receipt's QR address, for staff to hand over; made on first ask. */
export function useInvoiceRequestLink() {
  return useMutation({ mutationFn: invoiceRequestHttp.link });
}
