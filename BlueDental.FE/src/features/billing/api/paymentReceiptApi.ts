import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { readableBlobError } from "@/lib/apiError";
import { api } from "@/lib/axios";
import { ALWAYS_FRESH } from "@/lib/queryFreshness";
import type { LedgerMethod } from "./paymentLedgerApi";

/** Matches BlueDental.Billing.PatientPaymentStatus (P2610). */
export const RECEIPT_STATUS = { Pending: 1, Completed: 2, Issued: 3, Cancelled: 4 } as const;
export type ReceiptStatus = (typeof RECEIPT_STATUS)[keyof typeof RECEIPT_STATUS];

/** Matches BlueDental.Billing.PaymentCancelReason — the cancel page's four reasons. */
export const RECEIPT_CANCEL_REASON = { WrongPayer: 1, WrongAmountOrService: 2, Duplicate: 3, Other: 4 } as const;
export type ReceiptCancelReason = (typeof RECEIPT_CANCEL_REASON)[keyof typeof RECEIPT_CANCEL_REASON];

/** Matches BlueDental.Billing.ReceiptSignMode — the accountant's choice on export. */
export const RECEIPT_SIGN_MODE = { Unsigned: 1, Digital: 2 } as const;
export type ReceiptSignMode = (typeof RECEIPT_SIGN_MODE)[keyof typeof RECEIPT_SIGN_MODE];

/** Matches PaymentReceiptContentLineDto: one service the receipt pays, with its share. */
export interface ReceiptContentLineDto {
  name: string;
  amount: number;
}

/**
 * Matches PaymentReceiptContentDto — what the PHIẾU THU says, frozen when the
 * receipt was written, so a renamed service or patient never rewrites it.
 */
export interface ReceiptContentDto {
  patientCode: string;
  payerName: string;
  planCode: string;
  /** `YYYY-MM-DD`, the Ngày thanh toán picked on the dialog. */
  paidOn: string;
  method: LedgerMethod;
  amount: number;
  amountInWords: string;
  slipTotal: number;
  paidBefore: number;
  /** What the slip still owes once this receipt is paid. */
  remaining: number;
  remainingInWords: string;
  creatorName: string;
  lines: ReceiptContentLineDto[];
}

/** Matches PaymentReceiptDto — `GET patient-payments/{id}/receipt`. */
export interface PaymentReceiptDto {
  id: string;
  code: string;
  patientId: string;
  clinicBranchId: string;
  treatmentPlanId: string | null;
  status: ReceiptStatus;
  creationTime: string;
  issuedAt: string | null;
  issuedByName: string | null;
  confirmedByName: string | null;
  cancelledAt: string | null;
  cancelledByName: string | null;
  cancelReason: string | null;
  cancelReasonCode: ReceiptCancelReason | null;
  /** How it was exported; null until then. */
  signMode: ReceiptSignMode | null;
  /** Whether an exported file is kept — receipts issued before P2610 phase 5 have none. */
  hasFile: boolean;
  content: ReceiptContentDto;
}

export const paymentReceiptKeys = {
  all: ["payment-receipts"] as const,
  detail: (id: string) => [...paymentReceiptKeys.all, id] as const,
};

/**
 * One receipt for its own page. Another branch's receipt, or one that is not
 * a Thanh toán receipt, is refused (403 / 404) — that answer stands, so no retry.
 */
export function usePaymentReceipt(id: string) {
  return useQuery({
    queryKey: paymentReceiptKeys.detail(id),
    queryFn: () =>
      api.get<PaymentReceiptDto>(`/v1/app/patient-payments/${id}/receipt`).then((response) => response.data),
    enabled: Boolean(id),
    retry: false,
    ...ALWAYS_FRESH,
  });
}

/**
 * "In phiếu thu": the PHIẾU THU PDF the plan's Thanh toán tab prints, filled
 * on the server from the docx template. Nothing is stored.
 */
export function useReceiptPdf() {
  return useMutation({
    mutationFn: async (paymentId: string) => {
      try {
        const response = await api.post<Blob>(
          "/v1/app/e-invoices/receipt-pdf",
          { patientPaymentId: paymentId, buyerName: null, arisingDate: null, lines: [] },
          { responseType: "blob" },
        );
        return response.data;
      } catch (error) {
        throw await readableBlobError(error);
      }
    },
  });
}

/**
 * "Xuất phiếu thu" (P2610 phase 5): the server writes the signed PHIẾU THU
 * to PDF/A once and keeps it sealed; the receipt becomes Đã xuất phiếu thu
 * and the iPad session closes. Refused until the customer has signed.
 * The iPad state is refreshed by useReceiptExport, which owns both.
 */
export function useExportReceipt(paymentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (signMode: ReceiptSignMode) =>
      api
        .post<PaymentReceiptDto>(`/v1/app/patient-payments/${paymentId}/export`, { signMode })
        .then((response) => response.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: paymentReceiptKeys.detail(paymentId) }),
  });
}

/**
 * The exported file itself, exactly as written at export: the server
 * refuses one whose SHA-256 no longer matches rather than hand it out.
 */
export function useStoredReceiptPdf() {
  return useMutation({
    mutationFn: async (paymentId: string) => {
      try {
        const response = await api.get<Blob>(`/v1/app/patient-payments/${paymentId}/receipt-file`, {
          responseType: "blob",
        });
        return response.data;
      } catch (error) {
        throw await readableBlobError(error);
      }
    },
  });
}
