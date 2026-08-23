import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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

export interface CreateClinicBranchDto {
  code: string;
  name: string;
  address?: string;
  phoneNumber?: string;
  email?: string;
}

export interface UpdateClinicBranchDto {
  name: string;
  address?: string;
  phoneNumber?: string;
  email?: string;
}

export interface DepartmentDto {
  id: string;
  name: string;
  description?: string;
  branchId?: string;
  isActive: boolean;
}

export interface CreateDepartmentDto {
  name: string;
  description?: string;
}

export interface UpdateDepartmentDto {
  name: string;
  description?: string;
}

const organizationApi = {
  listBranches: (): Promise<PagedResult<ClinicBranchDto>> =>
    api.get("/v1/app/clinic-branches", { params: { maxResultCount: 50 } }).then((r) => r.data),

  getBranch: (id: string): Promise<ClinicBranchDto> =>
    api.get(`/v1/app/clinic-branches/${id}`).then((r) => r.data),

  createBranch: (data: CreateClinicBranchDto): Promise<ClinicBranchDto> =>
    api.post("/v1/app/clinic-branches", data).then((r) => r.data),

  updateBranch: (id: string, data: UpdateClinicBranchDto): Promise<ClinicBranchDto> =>
    api.put(`/v1/app/clinic-branches/${id}`, data).then((r) => r.data),

  deleteBranch: (id: string): Promise<void> =>
    api.delete(`/v1/app/clinic-branches/${id}`).then(() => undefined),

  listDepartments: (): Promise<PagedResult<DepartmentDto>> =>
    api.get("/v1/app/departments", { params: { maxResultCount: 50 } }).then((r) => r.data),

  createDepartment: (data: CreateDepartmentDto): Promise<DepartmentDto> =>
    api.post("/v1/app/departments", data).then((r) => r.data),

  updateDepartment: (id: string, data: UpdateDepartmentDto): Promise<DepartmentDto> =>
    api.put(`/v1/app/departments/${id}`, data).then((r) => r.data),

  deleteDepartment: (id: string): Promise<void> =>
    api.delete(`/v1/app/departments/${id}`).then(() => undefined),
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

export function useCreateBranch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateClinicBranchDto) => organizationApi.createBranch(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["clinic-branches"] }),
  });
}

export function useUpdateBranch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateClinicBranchDto }) =>
      organizationApi.updateBranch(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["clinic-branches"] }),
  });
}

export function useDeleteBranch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => organizationApi.deleteBranch(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["clinic-branches"] }),
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

export function useCreateDepartment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateDepartmentDto) => organizationApi.createDepartment(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["departments"] }),
  });
}

export function useUpdateDepartment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateDepartmentDto }) =>
      organizationApi.updateDepartment(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["departments"] }),
  });
}

export function useDeleteDepartment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => organizationApi.deleteDepartment(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["departments"] }),
  });
}

export interface UpdateClinicBranchInput {
  name: string;
  address?: string;
  phoneNumber?: string;
  email?: string;
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
