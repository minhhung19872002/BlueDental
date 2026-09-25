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
  id: string;
  name?: string;
  address?: string;
  phoneNumber?: string;
  email?: string;
}

function toBranchInfo(branch: BranchResponse): BranchInfo {
  return {
    name: branch.name ?? "",
    address: branch.address ?? null,
    phone: branch.phoneNumber ?? null,
    email: branch.email ?? null,
  };
}

/**
 * One clinic branch, for the screens outside Vận hành that print its
 * letterhead.
 *
 * Read from the accessible list — the branches the account may switch to,
 * which any signed-in user can fetch — rather than `clinic-branches/{id}`,
 * which is branch administration and refused to everyone without
 * `branchManager:read` (R-532: a labo reader printing "In Phiếu Labo" is not
 * a branch manager). The branch on screen is always one of the accessible ones.
 *
 * Lives here rather than in `features/organizations` because feature folders do
 * not import one another — the same reason `usePaymentAccountOptions` sits
 * beside it.
 */
export const branchInfoKeys = {
  all: ["branch-info"] as const,
};

export function useBranchInfo(branchId: string) {
  return useQuery<BranchResponse[], Error, BranchInfo | undefined>({
    queryKey: [...branchInfoKeys.all, "accessible"],
    queryFn: () =>
      api
        .get<{ items: BranchResponse[] }>("/v1/app/clinic-branches/accessible")
        .then((r) => r.data.items),
    select: (items) => {
      const branch = items.find((item) => item.id === branchId);
      return branch ? toBranchInfo(branch) : undefined;
    },
    enabled: Boolean(branchId),
    staleTime: 10 * 60_000,
  });
}
