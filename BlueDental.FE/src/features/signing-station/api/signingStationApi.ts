import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/axios";
import { readDeviceToken } from "./deviceToken";

// ── DTO mirror (SigningStationDto) ──────────────────────────────────────────

/** Matches BlueDental.Billing.SigningStationStage: which screen the iPad shows. */
export const STATION_STAGE = { Idle: 1, Review: 2, Signing: 3, Signed: 4, Issued: 5, Printed: 6 } as const;
export type StationStage = (typeof STATION_STAGE)[keyof typeof STATION_STAGE];

/** Matches PaymentReceiptContentDto: what the PHIẾU THU says, frozen when written. */
export interface StationReceiptDto {
  patientCode: string;
  payerName: string;
  planCode: string;
  paidOn: string;
  amount: number;
  amountInWords: string;
  remaining: number;
  remainingInWords: string;
  creatorName: string;
  /** Under "Tên trên phiếu", with what this receipt lets off each (P2910). */
  lines: { name: string; amount: number; cashierDiscount: number; voucherShare: number }[];
}

export interface SigningStationDto {
  /** The header: the branch name. */
  clinicName: string;
  deviceName: string;
  stage: StationStage;
  sessionId: string | null;
  paymentCode: string | null;
  receipt: StationReceiptDto | null;
  signatureDataUrl: string | null;
  /** A "Yêu cầu xuất hóa đơn" is already live for this receipt. */
  invoiceRequested: boolean;
  issuedAt: string | null;
  /** When "In phiếu thu" was confirmed, on "Cảm ơn quý khách" (P2910_02). */
  paperSignedAt: string | null;
}

/** Matches SubmitPublicInvoiceRequestDto; a blank personal field keeps the one on file. */
export interface StationInvoiceRequestDto {
  isCompany: boolean;
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

// ── HTTP ────────────────────────────────────────────────────────────────────

const BASE = "/v1/public/signing-station";
/** SigningDeviceConsts.TokenHeader — never the URL, which logs keep. */
const TOKEN_HEADER = "X-Signing-Device-Token";

const deviceHeaders = () => ({ headers: { [TOKEN_HEADER]: readDeviceToken() ?? "" } });
const session = (sessionId: string, action: string) => `${BASE}/sessions/${sessionId}/${action}`;

const stationHttp = {
  current: () => api.get<SigningStationDto>(BASE, deviceHeaders()).then((r) => r.data),
  check: (sessionId: string) =>
    api.post<SigningStationDto>(session(sessionId, "check"), null, deviceHeaders()).then((r) => r.data),
  sign: ({ sessionId, signatureDataUrl }: { sessionId: string; signatureDataUrl: string }) =>
    api.post<SigningStationDto>(session(sessionId, "sign"), { signatureDataUrl }, deviceHeaders()).then((r) => r.data),
  requestInvoice: ({ sessionId, body }: { sessionId: string; body: StationInvoiceRequestDto }) =>
    api.post<SigningStationDto>(session(sessionId, "invoice-request"), body, deviceHeaders()).then((r) => r.data),
};

// ── Hooks ───────────────────────────────────────────────────────────────────

export const stationKeys = { current: ["signing-station"] as const };

/** What the iPad shows now; the hub says when to read it again. */
export function useSigningStation(enabled: boolean) {
  return useQuery({
    queryKey: stationKeys.current,
    queryFn: stationHttp.current,
    enabled,
    // An unpaired device stays unpaired; asking again only delays the notice.
    retry: false,
    staleTime: 0,
    refetchOnWindowFocus: "always",
  });
}

/** Every iPad step answers with the next screen; it replaces the cached one. */
function useStationMutation<TInput>(run: (input: TInput) => Promise<SigningStationDto>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: run,
    // The screen shows the refusal itself; the PC's toast would be noise here.
    meta: { skipGlobalErrorToast: true },
    onSuccess: (station) => queryClient.setQueryData(stationKeys.current, station),
    onError: () => void queryClient.invalidateQueries({ queryKey: stationKeys.current }),
  });
}

/** Both boxes ticked: "Xác nhận thông tin". */
export const useCheckReceipt = () => useStationMutation(stationHttp.check);
/** "Hoàn tất ký". */
export const useSignReceipt = () => useStationMutation(stationHttp.sign);
/** "Lưu" on Thông tin xuất hóa đơn. */
export const useRequestStationInvoice = () => useStationMutation(stationHttp.requestInvoice);
