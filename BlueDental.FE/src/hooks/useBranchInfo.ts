import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/axios";

/** The letterhead facts a printed sheet needs about the clinic. */
export interface BranchInfo {
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
}

interface BranchResponse {
  name?: string;
  address?: string;
  phoneNumber?: string;
  email?: string;
}

/**
 * One clinic branch, for the screens outside Vận hành that print its
 * letterhead.
 *
 * Lives here rather than in `features/organizations` because feature folders do
 * not import one another — the same reason `usePaymentAccountOptions` sits
 * beside it.
 */
export function useBranchInfo(branchId: string) {
  return useQuery<BranchInfo>({
    queryKey: ["branch-info", branchId],
    queryFn: () =>
      api.get<BranchResponse>(`/v1/app/clinic-branches/${branchId}`).then((r) => ({
        name: r.data.name ?? "",
        address: r.data.address ?? null,
        phone: r.data.phoneNumber ?? null,
        email: r.data.email ?? null,
      })),
    enabled: Boolean(branchId),
    staleTime: 10 * 60_000,
  });
}
