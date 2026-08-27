import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/axios";
import type { PagedResult } from "@/types";

/** One material on a voucher: what went out, and what is confirmed still there. */
export interface MaterialAllocationItemDto {
  inventoryItemId: string;
  name: string;
  quantity: number;
  /** Null until a stock-take comes back, which is why the column reads "—". */
  confirmedQuantity: number | null;
}

export interface MaterialAllocationDto {
  id: string;
  allocationCode: string;
  departmentId: string;
  departmentName?: string;
  performerName?: string;
  note?: string;
  allocationTime: string;
  creationTime: string;
  /** A voucher carries several materials, as the reference issues them. */
  items: MaterialAllocationItemDto[];
}

export interface CreateMaterialAllocationDto {
  departmentId: string;
  items: Array<{ inventoryItemId: string; quantity: number }>;
  performerName?: string;
  note?: string;
}

const allocationApi = {
  list: (params?: {
    filter?: string;
    departmentId?: string;
    maxResultCount?: number;
  }): Promise<PagedResult<MaterialAllocationDto>> =>
    api.get("/v1/app/material-allocations", { params }).then((r) => r.data),
  create: (data: CreateMaterialAllocationDto): Promise<MaterialAllocationDto> =>
    api.post("/v1/app/material-allocations", data).then((r) => r.data),
  delete: (id: string): Promise<void> =>
    api.delete(`/v1/app/material-allocations/${id}`).then((r) => r.data),
};

export function useAllocationList(departmentId?: string, filter?: string) {
  return useQuery({
    queryKey: ["material-allocations", departmentId, filter],
    queryFn: () => allocationApi.list({ departmentId, filter, maxResultCount: 200 }),
  });
}

export function useCreateAllocation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateMaterialAllocationDto) => allocationApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["material-allocations"] });
      // Issuing material takes it off the clinic's shelf, so the list behind
      // the selection has to be re-read or it keeps showing the old stock.
      qc.invalidateQueries({ queryKey: ["supplies"] });
    },
  });
}

export function useDeleteAllocation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => allocationApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["material-allocations"] });
      // Cancelling a voucher puts its materials back.
      qc.invalidateQueries({ queryKey: ["supplies"] });
    },
  });
}
