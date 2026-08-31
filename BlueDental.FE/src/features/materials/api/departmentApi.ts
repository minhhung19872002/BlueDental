import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/axios";
import type { PagedResult } from "@/types";

export interface DepartmentDto {
  id: string;
  name: string;
  description?: string;
  branchId?: string;
  isActive: boolean;
  /** Where it sits in the panel; the reference orders its list by this. */
  sortOrder: number;
  creationTime: string;
  lastModificationTime?: string;
}

export interface CreateDepartmentDto {
  name: string;
  description?: string;
  sortOrder?: number;
}

export interface UpdateDepartmentDto {
  name: string;
  description?: string;
  sortOrder?: number;
}

const departmentApi = {
  list: (params?: {
    branchId?: string;
    filter?: string;
    maxResultCount?: number;
  }): Promise<PagedResult<DepartmentDto>> =>
    api.get("/v1/app/departments", { params }).then((r) => r.data),
  create: (data: CreateDepartmentDto): Promise<DepartmentDto> =>
    api.post("/v1/app/departments", data).then((r) => r.data),
  update: (id: string, data: UpdateDepartmentDto): Promise<DepartmentDto> =>
    api.put(`/v1/app/departments/${id}`, data).then((r) => r.data),
  delete: (id: string): Promise<void> =>
    api.delete(`/v1/app/departments/${id}`).then((r) => r.data),
  // One call carries the whole order, so a drag is one round trip.
  reorder: (ids: string[]): Promise<void> =>
    api.put("/v1/app/departments/reorder", { ids }).then((r) => r.data),
};

/**
 * The branch's departments, narrowed on the server.
 *
 * The filter goes into the query key as well as the request, so a typed term is
 * a real round trip rather than a sweep over whatever the first page happened
 * to contain — which quietly missed anything past it.
 */
export function useDepartmentList(filter?: string, branchId?: string) {
  const term = filter?.trim() || undefined;

  return useQuery({
    queryKey: ["departments", branchId, term],
    queryFn: () => departmentApi.list({ branchId, filter: term, maxResultCount: 200 }),
  });
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

export function useReorderDepartments() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => departmentApi.reorder(ids),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["departments"] }),
  });
}
