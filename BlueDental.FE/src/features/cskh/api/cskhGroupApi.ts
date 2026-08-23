import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/axios";
import type { PagedResult } from "@/types";

export interface CskhGroupDto {
  id: string;
  name: string;
  criteria?: string;
  description?: string;
  isActive: boolean;
  creationTime: string;
  lastModificationTime?: string;
}

export interface CreateCskhGroupDto { name: string; criteria?: string; description?: string; }
export interface UpdateCskhGroupDto { name: string; criteria?: string; description?: string; }

const cskhGroupApi = {
  list: (params?: { filter?: string; maxResultCount?: number }): Promise<PagedResult<CskhGroupDto>> =>
    api.get("/v1/app/cskh-groups", { params }).then((r) => r.data),
  create: (data: CreateCskhGroupDto): Promise<CskhGroupDto> =>
    api.post("/v1/app/cskh-groups", data).then((r) => r.data),
  update: (id: string, data: UpdateCskhGroupDto): Promise<CskhGroupDto> =>
    api.put(`/v1/app/cskh-groups/${id}`, data).then((r) => r.data),
  delete: (id: string): Promise<void> =>
    api.delete(`/v1/app/cskh-groups/${id}`).then((r) => r.data),
};

export function useCskhGroupList() {
  return useQuery({ queryKey: ["cskh-groups"], queryFn: () => cskhGroupApi.list({ maxResultCount: 200 }) });
}

export function useCreateCskhGroup() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (data: CreateCskhGroupDto) => cskhGroupApi.create(data), onSuccess: () => qc.invalidateQueries({ queryKey: ["cskh-groups"] }) });
}

export function useUpdateCskhGroup() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ id, data }: { id: string; data: UpdateCskhGroupDto }) => cskhGroupApi.update(id, data), onSuccess: () => qc.invalidateQueries({ queryKey: ["cskh-groups"] }) });
}

export function useDeleteCskhGroup() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => cskhGroupApi.delete(id), onSuccess: () => qc.invalidateQueries({ queryKey: ["cskh-groups"] }) });
}
