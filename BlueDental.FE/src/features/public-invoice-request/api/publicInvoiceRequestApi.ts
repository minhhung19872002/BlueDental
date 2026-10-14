import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/axios";

// ── DTO mirror (PublicInvoiceRequestFormDto / ResultDto) ────────────────────

/**
 * What the page behind the QR may show: the receipt, and the customer's own
 * details with the phone, CCCD, email and address cut down to a hint.
 */
export interface PublicInvoiceRequestFormDto {
  clinicName: string;
  paymentCode: string;
  serviceName: string;
  amount: number;
  fullName: string;
  birthYear: number | null;
  phoneHint: string | null;
  nationalIdHint: string | null;
  emailHint: string | null;
  addressHint: string | null;
  submitted: boolean;
  expired: boolean;
}

/** The THÔNG TIN XUẤT HÓA ĐƠN answers; a blank contact field keeps the one on file. */
export interface PublicInvoiceRequestSubmitDto {
  /** Loại hóa đơn: Công ty (true) or Cá nhân. */
  isCompany: boolean;
  /** Cá nhân only; Công ty takes the patient's name. */
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

export interface PublicInvoiceRequestResultDto {
  code: string;
  dueAt: string;
}

// ── HTTP ────────────────────────────────────────────────────────────────────

const BASE = "/v1/public/invoice-requests";

const publicInvoiceRequestHttp = {
  form: (token: string) =>
    api.get<PublicInvoiceRequestFormDto>(`${BASE}/${encodeURIComponent(token)}`).then((r) => r.data),
  submit: ({ token, body }: { token: string; body: PublicInvoiceRequestSubmitDto }) =>
    api
      .post<PublicInvoiceRequestResultDto>(`${BASE}/${encodeURIComponent(token)}`, body)
      .then((r) => r.data),
};

// ── Hooks ───────────────────────────────────────────────────────────────────

export function usePublicInvoiceRequestForm(token: string) {
  return useQuery({
    queryKey: ["public-invoice-request", token],
    queryFn: () => publicInvoiceRequestHttp.form(token),
    enabled: Boolean(token),
    // An unknown or broken link stays broken; asking again only delays the message.
    retry: false,
    refetchOnWindowFocus: false,
  });
}

/** The single submit the link allows; the page shows the refusal itself. */
export function useSubmitPublicInvoiceRequest() {
  return useMutation({
    mutationFn: publicInvoiceRequestHttp.submit,
    meta: { skipGlobalErrorToast: true },
  });
}
