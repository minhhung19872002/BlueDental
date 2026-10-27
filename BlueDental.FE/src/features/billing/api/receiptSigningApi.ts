import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/axios";
import { ALWAYS_FRESH } from "@/lib/queryFreshness";
import { paymentReceiptKeys } from "./paymentReceiptApi";

/** Matches BlueDental.Billing.SigningCloseReason. */
export const SIGNING_CLOSE_REASON = { Cancelled: 1, Issued: 2, ReceiptCancelled: 3, Revised: 4, Replaced: 5 } as const;
export type SigningCloseReason = (typeof SIGNING_CLOSE_REASON)[keyof typeof SIGNING_CLOSE_REASON];

/** Matches ReceiptSigningSessionDto: one trip of the receipt to the iPad. */
export interface ReceiptSigningSessionDto {
  id: string;
  isOpen: boolean;
  /** Gửi tới iPad. */
  sentAt: string;
  /** Khách kiểm tra. */
  checkedAt: string | null;
  /** Khách đồng ý & ký. */
  signedAt: string | null;
  closedAt: string | null;
  closeReason: SigningCloseReason | null;
  /** `data:image/png;base64,…`, decrypted for this screen only. */
  signatureDataUrl: string | null;
}

/** Matches ReceiptSigningStateDto — `GET receipt-signing/{patientPaymentId}`. */
export interface ReceiptSigningStateDto {
  /** The branch has a paired iPad (Cài đặt → Kết nối iPad). */
  hasDevice: boolean;
  /** THANHTOAN-… the iPad shows instead of this receipt. */
  busyWithCode: string | null;
  session: ReceiptSigningSessionDto | null;
}

const BASE = "/v1/app/receipt-signing";

export const receiptSigningKeys = {
  all: ["receipt-signing"] as const,
  detail: (paymentId: string) => [...receiptSigningKeys.all, paymentId] as const,
};

const receiptSigningHttp = {
  get: (paymentId: string) => api.get<ReceiptSigningStateDto>(`${BASE}/${paymentId}`).then((r) => r.data),
  send: ({ paymentId, replace }: { paymentId: string; replace: boolean }) =>
    api.post<ReceiptSigningStateDto>(`${BASE}/${paymentId}/send`, { replace }).then((r) => r.data),
  cancel: (paymentId: string) => api.post<ReceiptSigningStateDto>(`${BASE}/${paymentId}/cancel`).then((r) => r.data),
  resign: (paymentId: string) => api.post<ReceiptSigningStateDto>(`${BASE}/${paymentId}/resign`).then((r) => r.data),
};

/** What the customer has done on the iPad; the hub says when to read it again. */
export function useReceiptSigning(paymentId: string) {
  return useQuery({
    queryKey: receiptSigningKeys.detail(paymentId),
    queryFn: () => receiptSigningHttp.get(paymentId),
    enabled: Boolean(paymentId),
    retry: false,
    ...ALWAYS_FRESH,
  });
}

/** Each iPad button answers with the new state; it replaces the cached one. */
function useSigningMutation<TInput>(run: (input: TInput) => Promise<ReceiptSigningStateDto>, paymentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: run,
    onSuccess: (state) => {
      queryClient.setQueryData(receiptSigningKeys.detail(paymentId), state);
      void queryClient.invalidateQueries({ queryKey: paymentReceiptKeys.detail(paymentId) });
    },
  });
}

/** Gửi tới iPad / Gửi lại; `replace` ends the session of the receipt the iPad shows. */
export function useSendReceiptToDevice(paymentId: string) {
  return useSigningMutation((replace: boolean) => receiptSigningHttp.send({ paymentId, replace }), paymentId);
}

/** Hủy phiên & sửa phiếu. */
export function useCancelReceiptSigning(paymentId: string) {
  return useSigningMutation(() => receiptSigningHttp.cancel(paymentId), paymentId);
}

/** Yêu cầu khách ký lại. */
export function useRequestReceiptResign(paymentId: string) {
  return useSigningMutation(() => receiptSigningHttp.resign(paymentId), paymentId);
}
