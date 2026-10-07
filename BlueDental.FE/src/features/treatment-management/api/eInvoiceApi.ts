import { useMutation, useQuery } from "@tanstack/react-query";
import axios from "axios";
import { api } from "@/lib/axios";
import { downloadFile } from "@/lib/download";
import type { QueryEntity } from "@/lib/queryEntities";

// ── DTO mirror ──────────────────────────────────────────────────────────────

export const EINVOICE_STATUS = {
  Draft: 0,
  Published: 1,
  Cancelled: 2,
  Replaced: 3,
  Adjusted: 4,
} as const;

export type EInvoiceStatus = (typeof EINVOICE_STATUS)[keyof typeof EINVOICE_STATUS];

/** HTHTTToan the provider prints: TM, CK or TM/CK. */
export const EINVOICE_PAYMENT_METHOD = {
  Cash: 1,
  Transfer: 2,
  CashOrTransfer: 3,
} as const;

export type EInvoicePaymentMethod =
  (typeof EINVOICE_PAYMENT_METHOD)[keyof typeof EINVOICE_PAYMENT_METHOD];

/** VAT rates EasyInvoice knows; -1 is "KCT" (not subject to VAT). */
export const EINVOICE_VAT_RATES = [-1, 0, 5, 8, 10] as const;

export interface ElectronicInvoiceDto {
  id: string;
  clinicBranchId: string;
  patientId: string;
  patientPaymentId: string | null;
  treatmentPlanId: string | null;
  providerConfigId: string | null;
  provider: string;
  ikey: string;
  pattern: string;
  serial: string | null;
  status: EInvoiceStatus;
  no: string | null;
  lookupCode: string | null;
  linkView: string | null;
  total: number;
  taxAmount: number;
  amount: number;
  customerName: string;
  paymentMethod: string;
  arisingDate: string | null;
  lastSyncedAt: string | null;
  lastError: string | null;
  creationTime: string;
}

export interface ElectronicInvoiceLineDto {
  code: string;
  name: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  total: number;
  vatRate: number;
  taxAmount: number;
  amount: number;
}

/** A Mẫu số / Ký hiệu pair the branch has used (the suggested one first). */
export interface ElectronicInvoiceNumberingDto {
  pattern: string;
  serial: string | null;
}

export interface ElectronicInvoiceDraftDto {
  patientPaymentId: string | null;
  treatmentPlanId: string | null;
  isConfigured: boolean;
  configName: string | null;
  pattern: string | null;
  serial: string | null;
  defaultVatRate: number;
  customerCode: string;
  buyerName: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  nationalId: string | null;
  paymentMethod: EInvoicePaymentMethod;
  maxAmount: number;
  lines: ElectronicInvoiceLineDto[];
  numberings: ElectronicInvoiceNumberingDto[];
  existing: ElectronicInvoiceDto | null;
}

export interface ElectronicInvoiceLineInput {
  code: string;
  name: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  /** null → the account's default rate. */
  vatRate: number | null;
}

/** Exactly one of patientPaymentId / treatmentPlanId. */
export type EInvoiceSource =
  | { patientPaymentId: string; treatmentPlanId?: undefined }
  | { treatmentPlanId: string; patientPaymentId?: undefined };

export type IssueElectronicInvoiceInput = EInvoiceSource & {
  publish: boolean;
  buyerName: string | null;
  companyName: string | null;
  address: string | null;
  taxCode: string | null;
  phone: string | null;
  email: string | null;
  nationalId: string | null;
  arisingDate: string | null;
  paymentMethod: EInvoicePaymentMethod;
  /** Blank → the numbering the branch's account suggests. */
  pattern: string | null;
  serial: string | null;
  /** The server only issues VND at rate 1 and says so otherwise. */
  currency: string | null;
  exchangeRate: number | null;
  lines: ElectronicInvoiceLineInput[];
};

/** PHIẾU THU: what the dialog shows now, so the paper matches the screen. */
export type RenderPaymentReceiptInput = EInvoiceSource & {
  buyerName: string | null;
  arisingDate: string | null;
  lines: ElectronicInvoiceLineInput[];
};

interface GetEInvoiceListInput {
  patientPaymentId?: string;
  treatmentPlanId?: string;
  patientId?: string;
  clinicBranchId?: string;
}

/**
 * Whether a receipt may still be sent to the provider, mirroring the server:
 * a signed invoice is never re-sent (EInvoicing:0004) and a slip billed whole
 * is not billed again receipt by receipt (EInvoicing:0012) unless that whole
 * invoice was cancelled. Until the list loads the server is left to decide.
 */
export function isReceiptInvoiceable(
  paymentId: string,
  planInvoices: readonly ElectronicInvoiceDto[] | undefined,
): boolean {
  if (!planInvoices) return true;
  const own = planInvoices.find((inv) => inv.patientPaymentId === paymentId);
  if (own && own.status !== EINVOICE_STATUS.Draft) return false;
  return !planInvoices.some((inv) => inv.patientPaymentId === null && inv.status !== EINVOICE_STATUS.Cancelled);
}

// ── Query keys ──────────────────────────────────────────────────────────────

export const eInvoiceKeys = {
  all: ["e-invoices"] as const,
  byPlan: (treatmentPlanId: string, clinicBranchId: string) =>
    [...eInvoiceKeys.all, { treatmentPlanId, clinicBranchId }] as const,
  draft: (source: EInvoiceSource) => [...eInvoiceKeys.all, "draft", source] as const,
};

// ── Queries ─────────────────────────────────────────────────────────────────

/**
 * Every e-invoice on this slip: the per-receipt ones (their receipts carry the
 * slip) and the whole-slip one.
 */
export function usePlanEInvoices(params: {
  treatmentPlanId: string;
  clinicBranchId: string;
}) {
  return useQuery({
    queryKey: eInvoiceKeys.byPlan(params.treatmentPlanId, params.clinicBranchId),
    queryFn: async () => {
      const input: GetEInvoiceListInput = {
        treatmentPlanId: params.treatmentPlanId,
        clinicBranchId: params.clinicBranchId,
      };
      const res = await api.get<{ items: ElectronicInvoiceDto[] }>(
        "/v1/app/e-invoices",
        { params: input },
      );
      return res.data.items;
    },
  });
}

/** What the dialog opens with: buyer, account, default lines, cap, existing invoice. */
export function useEInvoiceDraft(source: EInvoiceSource, enabled: boolean) {
  return useQuery({
    queryKey: eInvoiceKeys.draft(source),
    queryFn: async () => {
      const res = await api.get<ElectronicInvoiceDraftDto>("/v1/app/e-invoices/draft", {
        params: source,
      });
      return res.data;
    },
    enabled,
    staleTime: 0,
    gcTime: 0,
  });
}

// ── Mutations ───────────────────────────────────────────────────────────────

const INVALIDATES: readonly QueryEntity[] = ["eInvoice", "payment"];

/** Lưu Nháp (publish=false) or Phát Hành (publish=true). */
export function useIssueEInvoice() {
  return useMutation({
    mutationFn: async (input: IssueElectronicInvoiceInput) => {
      const res = await api.post<ElectronicInvoiceDto>("/v1/app/e-invoices/issue", input);
      return res.data;
    },
    meta: { invalidates: INVALIDATES },
  });
}

/**
 * A blob request gets its ABP error back as a Blob too; parse it so the global
 * error toast can read the server's message instead of a bare status.
 */
async function withReadableError(error: unknown): Promise<unknown> {
  if (!axios.isAxiosError(error) || !(error.response?.data instanceof Blob)) return error;
  try {
    error.response.data = JSON.parse(await error.response.data.text());
  } catch {
    // Not JSON (a proxy page, say): the status alone picks the message.
    error.response.data = undefined;
  }
  return error;
}

/**
 * Phát Hành: the PHIẾU THU as a PDF, filled on the server from the docx
 * template. Nothing is stored, so nothing is invalidated.
 */
export function useRenderPaymentReceipt() {
  return useMutation({
    mutationFn: async (input: RenderPaymentReceiptInput) => {
      try {
        const res = await api.post<Blob>("/v1/app/e-invoices/receipt-pdf", input, { responseType: "blob" });
        return res.data;
      } catch (error) {
        throw await withReadableError(error);
      }
    },
  });
}

export function useSyncEInvoice() {
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.post<ElectronicInvoiceDto>(
        `/v1/app/e-invoices/${id}/sync`,
      );
      return res.data;
    },
    meta: { invalidates: INVALIDATES },
  });
}

/** Download the provider's PDF through our backend (auth-proxied). */
export function downloadEInvoicePdf(invoice: Pick<ElectronicInvoiceDto, "id" | "no" | "ikey">): Promise<void> {
  return downloadFile(
    `/v1/app/e-invoices/${invoice.id}/pdf`,
    `hoa-don-dien-tu-${invoice.no ?? invoice.ikey}.pdf`,
  );
}
