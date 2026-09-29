import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/axios";
import { downloadFile } from "@/lib/download";
import type { QueryEntity } from "@/lib/queryEntities";

// ── DTO mirror ──────────────────────────────────────────────────────────────

export const EINVOICE_STATUS = {
  Draft: 0,
  Published: 1,
  Cancelled: 2,
} as const;

export type EInvoiceStatus = (typeof EINVOICE_STATUS)[keyof typeof EINVOICE_STATUS];

export interface ElectronicInvoiceDto {
  id: string;
  clinicBranchId: string;
  patientId: string;
  patientPaymentId: string;
  treatmentPlanId: string | null;
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
  lastSyncedAt: string | null;
  lastError: string | null;
  creationTime: string;
}

interface GetEInvoiceListInput {
  patientPaymentId?: string;
  treatmentPlanId?: string;
  patientId?: string;
  clinicBranchId?: string;
}

// ── Query keys ──────────────────────────────────────────────────────────────

export const eInvoiceKeys = {
  all: ["e-invoices"] as const,
  byPlan: (treatmentPlanId: string, clinicBranchId: string) =>
    [...eInvoiceKeys.all, { treatmentPlanId, clinicBranchId }] as const,
};

// ── Queries ─────────────────────────────────────────────────────────────────

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

// ── Mutations ───────────────────────────────────────────────────────────────

const INVALIDATES: readonly QueryEntity[] = ["eInvoice", "payment"];

export function useIssueEInvoice() {
  return useMutation({
    mutationFn: async (patientPaymentId: string) => {
      const res = await api.post<ElectronicInvoiceDto>(
        `/v1/app/e-invoices/issue-from-payment/${patientPaymentId}`,
      );
      return res.data;
    },
    meta: { invalidates: INVALIDATES },
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
export function downloadEInvoicePdf(id: string): Promise<void> {
  return downloadFile(`/v1/app/e-invoices/${id}/pdf`, `hoa-don-dien-tu-${id}.pdf`);
}
