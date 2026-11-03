import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/axios";
import { ALWAYS_FRESH } from "@/lib/queryFreshness";

/** Matches BlueDental.Billing.AccountantSignatureSource. */
export const ACCOUNTANT_SIGNATURE_SOURCE = { Drawn: 1, Uploaded: 2 } as const;
export type AccountantSignatureSource =
  (typeof ACCOUNTANT_SIGNATURE_SOURCE)[keyof typeof ACCOUNTANT_SIGNATURE_SOURCE];

/** Matches AccountantSignatureDto — the signed-in user's own Ký điện tử signature (P2910_02). */
export interface AccountantSignatureDto {
  /** `data:image/png;base64,…`, decrypted for this screen only. */
  signatureDataUrl: string;
  source: AccountantSignatureSource;
  /** "lưu dd/MM/yyyy" — also what an export keeps as the signer's timestamp. */
  savedAt: string;
  userName: string;
}

/** Matches SaveAccountantSignatureDto: Lưu chữ ký (drawn) or Dùng chữ ký này (uploaded). */
export interface SaveAccountantSignatureInput {
  signatureDataUrl: string;
  source: AccountantSignatureSource;
}

const BASE = "/v1/app/accountant-signature/mine";

export const accountantSignatureKeys = {
  mine: ["accountant-signature", "mine"] as const,
};

/** The user's saved signature; the server answers 204 when there is none yet. */
export function useMyAccountantSignature(enabled: boolean) {
  return useQuery({
    queryKey: accountantSignatureKeys.mine,
    queryFn: () => api.get<AccountantSignatureDto | "">(BASE).then((response) => response.data || null),
    enabled,
    retry: false,
    ...ALWAYS_FRESH,
  });
}

/** Saving replaces the user's signature; the server keeps a log row of every save. */
export function useSaveAccountantSignature() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SaveAccountantSignatureInput) =>
      api.put<AccountantSignatureDto>(BASE, input).then((response) => response.data),
    onSuccess: (saved) => queryClient.setQueryData(accountantSignatureKeys.mine, saved),
  });
}
