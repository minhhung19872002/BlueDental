import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/axios";
import type { PagedResult } from "@/types";

export interface DepartmentDto {
  id: string;
  name: string;
  description?: string;
  branchId?: string;
  isActive: boolean;
  creationTime: string;
  lastModificationTime?: string;
}

export interface CreateDepartmentDto { name: string; description?: string; }
export interface UpdateDepartmentDto { name: string; description?: string; }

const departmentApi = {
  list: (params?: { filter?: string; maxResultCount?: number }): Promise<PagedResult<DepartmentDto>> =>
    api.get("/v1/app/departments", { params }).then((r) => r.data),
  create: (data: CreateDepartmentDto): Promise<DepartmentDto> =>
    api.post("/v1/app/departments", data).then((r) => r.data),
  update: (id: string, data: UpdateDepartmentDto): Promise<DepartmentDto> =>
    api.put(`/v1/app/departments/${id}`, data).then((r) => r.data),
  delete: (id: string): Promise<void> =>
    api.delete(`/v1/app/departments/${id}`).then((r) => r.data),
};

export function useDepartmentList() {
  return useQuery({ queryKey: ["departments"], queryFn: () => departmentApi.list({ maxResultCount: 200 }) });
}

export function useCreateDepartment() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (data: CreateDepartmentDto) => departmentApi.create(data), onSuccess: () => qc.invalidateQueries({ queryKey: ["departments"] }) });
}

export function useUpdateDepartment() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ id, data }: { id: string; data: UpdateDepartmentDto }) => departmentApi.update(id, data), onSuccess: () => qc.invalidateQueries({ queryKey: ["departments"] }) });
}

export function useDeleteDepartment() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => departmentApi.delete(id), onSuccess: () => qc.invalidateQueries({ queryKey: ["departments"] }) });
}
