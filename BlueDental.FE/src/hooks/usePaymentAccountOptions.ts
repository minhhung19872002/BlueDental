import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/axios";
import type { PagedResult } from "@/types";

/** Mirrors BlueDental.Catalogs.PaymentAccountKind. */
export const PAYMENT_ACCOUNT_KIND = { MoMo: 1, Bank: 2 } as const;
export type PaymentAccountKindCode =
  (typeof PAYMENT_ACCOUNT_KIND)[keyof typeof PAYMENT_ACCOUNT_KIND];

/**
 * One of the clinic's collecting accounts, as the payment dialog lists them.
 *
 * Shared rather than feature-local: the Danh mục screen owns the catalog and a
 * feature may not reach into another feature's folder, but the record's payment
 * dialog has to offer the same list.
 */
export interface PaymentAccountOption {
  id: string;
  kind: PaymentAccountKindCode;
  holderName: string;
  /** MoMo rows only. */
  phoneNumber: string | null;
  /** Bank rows only. */
  bankName: string | null;
  accountNumber: string | null;
  isActive: boolean;
}

/**
 * The active accounts of one kind in this branch.
 *
 * The reference requires one of these before a Ngân hàng or Ví momo payment can
 * be saved, and reads them from the same catalog: `payment-method/list?type=`.
 */
export function usePaymentAccountOptions(
  clinicBranchId: string,
  kind: PaymentAccountKindCode | null,
) {
  return useQuery({
    queryKey: ["payment-account-options", clinicBranchId, kind],
    queryFn: async (): Promise<PaymentAccountOption[]> => {
      const response = await api.get<PagedResult<PaymentAccountOption>>(
        "/v1/app/payment-accounts",
        { params: { clinicBranchId, kind, maxResultCount: 100 } },
      );
      return (response.data?.items ?? []).filter((account) => account.isActive);
    },
    enabled: Boolean(clinicBranchId) && kind !== null,
    // The catalog changes rarely and the dialog reopens often.
    staleTime: 5 * 60 * 1000,
  });
}
