import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/axios";
import type { PagedResult } from "@/types";

export interface ClinicBranchDto {
  id: string;
  code: string;
  name: string;
  address?: string;
  phoneNumber?: string;
  email?: string;
  status: string;
}

export interface DepartmentDto {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
}

const organizationApi = {
  listBranches: (): Promise<PagedResult<ClinicBranchDto>> =>
    api.get("/v1/app/clinic-branches", { params: { maxResultCount: 50 } }).then((r) => r.data),

  getBranch: (id: string): Promise<ClinicBranchDto> =>
    api.get(`/v1/app/clinic-branches/${id}`).then((r) => r.data),

  listDepartments: (): Promise<PagedResult<DepartmentDto>> =>
    api.get("/v1/app/departments", { params: { maxResultCount: 50 } }).then((r) => r.data),
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

export function useDepartments() {
  return useQuery({
    queryKey: ["departments"],
    queryFn: () => organizationApi.listDepartments(),
    select: (d) => d.items,
    staleTime: 10 * 60_000,
  });
}
