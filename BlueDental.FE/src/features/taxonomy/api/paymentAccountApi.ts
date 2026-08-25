import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/axios";
import { t } from "@/lib/i18n";
import type { PagedResult } from "@/types";

/** Mirrors BlueDental.Catalogs.PaymentAccountKind. */
export const PAYMENT_ACCOUNT_KIND = {
  MoMo: 1,
  Bank: 2,
} as const;

export type PaymentAccountKind = (typeof PAYMENT_ACCOUNT_KIND)[keyof typeof PAYMENT_ACCOUNT_KIND];

export const paymentAccountKindLabels = (): Record<PaymentAccountKind, string> => ({
  [PAYMENT_ACCOUNT_KIND.MoMo]: "MoMo",
  [PAYMENT_ACCOUNT_KIND.Bank]: t("Ngân hàng"),
});

/** Mirrors BlueDental.Catalogs.PaymentAccountDto. */
export interface PaymentAccountDto {
  id: string;
  clinicBranchId: string;
  kind: PaymentAccountKind;
  holderName: string;
  phoneNumber: string | null;
  bankName: string | null;
  accountNumber: string | null;
  isActive: boolean;
  hasQrImage: boolean;
  qrImageFileName: string | null;
  /** Where the browser fetches the QR bytes from; null when there is none. */
  qrImageUrl: string | null;
  lastModificationTime: string | null;
  creationTime: string;
}

export interface CreatePaymentAccountInput {
  clinicBranchId: string;
  kind: PaymentAccountKind;
  holderName: string;
  phoneNumber?: string;
  bankName?: string;
  accountNumber?: string;
}

export interface UpdatePaymentAccountInput {
  holderName: string;
  phoneNumber?: string;
  bankName?: string;
  accountNumber?: string;
  isActive: boolean;
}

export interface PaymentAccountQuery {
  kind: PaymentAccountKind;
  skipCount: number;
  maxResultCount: number;
}

const paymentAccountApi = {
  list: (params: {
    clinicBranchId?: string;
    kind: PaymentAccountKind;
    skipCount?: number;
    maxResultCount?: number;
  }): Promise<PagedResult<PaymentAccountDto>> =>
    api
      .get<PagedResult<PaymentAccountDto>>("/v1/app/payment-accounts", { params })
      .then((r) => r.data),

  create: (input: CreatePaymentAccountInput): Promise<PaymentAccountDto> =>
    api.post<PaymentAccountDto>("/v1/app/payment-accounts", input).then((r) => r.data),

  update: (id: string, input: UpdatePaymentAccountInput): Promise<PaymentAccountDto> =>
    api.put<PaymentAccountDto>(`/v1/app/payment-accounts/${id}`, input).then((r) => r.data),

  remove: (id: string): Promise<void> =>
    api.delete(`/v1/app/payment-accounts/${id}`).then(() => undefined),

  uploadQrImage: (id: string, file: File): Promise<PaymentAccountDto> => {
    const form = new FormData();
    form.append("file", file);

    return api
      .post<PaymentAccountDto>(`/v1/app/payment-accounts/${id}/qr-image`, form)
      .then((r) => r.data);
  },

  removeQrImage: (id: string): Promise<PaymentAccountDto> =>
    api.delete<PaymentAccountDto>(`/v1/app/payment-accounts/${id}/qr-image`).then((r) => r.data),
};

export const paymentAccountKeys = {
  all: ["payment-accounts"] as const,
  list: (branchId: string | undefined, query: PaymentAccountQuery) =>
    [
      ...paymentAccountKeys.all,
      branchId,
      query.kind,
      query.skipCount,
      query.maxResultCount,
    ] as const,
};

export function usePaymentAccounts(branchId: string | undefined, query: PaymentAccountQuery) {
  return useQuery({
    queryKey: paymentAccountKeys.list(branchId, query),
    queryFn: () =>
      paymentAccountApi.list({
        clinicBranchId: branchId,
        kind: query.kind,
        skipCount: query.skipCount,
        maxResultCount: query.maxResultCount,
      }),
    placeholderData: (previous) => previous,
  });
}

function usePaymentAccountMutation<TVariables, TData>(
  fn: (variables: TVariables) => Promise<TData>,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: paymentAccountKeys.all });
    },
  });
}

export function useCreatePaymentAccount() {
  return usePaymentAccountMutation((input: CreatePaymentAccountInput) =>
    paymentAccountApi.create(input),
  );
}

export function useUpdatePaymentAccount() {
  return usePaymentAccountMutation(
    ({ id, input }: { id: string; input: UpdatePaymentAccountInput }) =>
      paymentAccountApi.update(id, input),
  );
}

export function useDeletePaymentAccount() {
  return usePaymentAccountMutation((id: string) => paymentAccountApi.remove(id));
}

/** "Tải ảnh QR" — the image is attached to an account that already exists. */
export function useUploadPaymentAccountQrImage() {
  return usePaymentAccountMutation(({ id, file }: { id: string; file: File }) =>
    paymentAccountApi.uploadQrImage(id, file),
  );
}

export function useDeletePaymentAccountQrImage() {
  return usePaymentAccountMutation((id: string) => paymentAccountApi.removeQrImage(id));
}
