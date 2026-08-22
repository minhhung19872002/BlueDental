import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/axios";
import type { PagedResult } from "@/types";

export interface MaterialAllocationDto {
  id: string;
  allocationCode: string;
  inventoryItemId: string;
  inventoryItemName?: string;
  departmentId: string;
  departmentName?: string;
  allocatedQuantity: number;
  confirmedRemaining: number;
  performerName?: string;
  note?: string;
  allocationTime: string;
  creationTime: string;
}

export interface CreateMaterialAllocationDto {
  inventoryItemId: string;
  departmentId: string;
  allocatedQuantity: number;
  performerName?: string;
  note?: string;
}

const allocationApi = {
  list: (params?: { filter?: string; departmentId?: string; maxResultCount?: number }): Promise<PagedResult<MaterialAllocationDto>> =>
    api.get("/v1/app/material-allocations", { params }).then((r) => r.data),
  create: (data: CreateMaterialAllocationDto): Promise<MaterialAllocationDto> =>
    api.post("/v1/app/material-allocations", data).then((r) => r.data),
  delete: (id: string): Promise<void> =>
    api.delete(`/v1/app/material-allocations/${id}`).then((r) => r.data),
};

export function useAllocationList(departmentId?: string) {
  return useQuery({
    queryKey: ["material-allocations", departmentId],
    queryFn: () => allocationApi.list({ departmentId, maxResultCount: 200 }),
  });
}

export function useCreateAllocation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateMaterialAllocationDto) => allocationApi.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["material-allocations"] }),
  });
}

export function useDeleteAllocation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => allocationApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["material-allocations"] }),
  });
}
