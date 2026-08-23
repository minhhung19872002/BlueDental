import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/axios";
import type { PagedResult } from "@/types";

export interface UpdateClinicBranchInput {
  name: string;
  address?: string;
  phoneNumber?: string;
  email?: string;
}

export interface ClinicBranchDto {
  id: string;
  code: string;
  name: string;
  address?: string;
  phoneNumber?: string;
  email?: string;
  status: string;
}

const organizationApi = {
  listBranches: (): Promise<PagedResult<ClinicBranchDto>> =>
    api.get("/v1/app/clinic-branches", { params: { maxResultCount: 50 } }).then((r) => r.data),

  getBranch: (id: string): Promise<ClinicBranchDto> =>
    api.get(`/v1/app/clinic-branches/${id}`).then((r) => r.data),

  updateBranch: (id: string, input: UpdateClinicBranchInput): Promise<ClinicBranchDto> =>
    api.put(`/v1/app/clinic-branches/${id}`, input).then((r) => r.data),
};

export function useClinicBranches() {
  return useQuery({
    queryKey: ["clinic-branches"],
    queryFn: () => organizationApi.listBranches(),
    select: (d) => d.items,
    staleTime: 10 * 60_000,
  });
}

export function useClinicBranch(id: string) {
  return useQuery({
    queryKey: ["clinic-branches", id],
    queryFn: () => organizationApi.getBranch(id),
    enabled: Boolean(id),
    staleTime: 10 * 60_000,
  });
}

export function useUpdateClinicBranch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateClinicBranchInput }) =>
      organizationApi.updateBranch(id, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["clinic-branches"] });
    },
  });
}
