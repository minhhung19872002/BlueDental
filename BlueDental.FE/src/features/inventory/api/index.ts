import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/axios";

export interface InventoryItemDto {
  id: string;
  itemCode: string;
  name: string;
  unit: string;
  category: string;
  currentStock: number;
  minimumStock: number;
  unitPrice: number;
  isLowStock: boolean;
}

const inventoryApi = {
  list: (params: { skipCount?: number; maxResultCount?: number; filter?: string }): Promise<{ items: InventoryItemDto[]; totalCount: number }> =>
    api.get("/v1/app/inventory-items", { params }).then((r) => r.data),

  get: (id: string): Promise<InventoryItemDto> =>
    api.get(`/v1/app/inventory-items/${id}`).then((r) => r.data),

  adjustStock: (id: string, adjustment: number, note: string): Promise<InventoryItemDto> =>
    api.post(`/v1/app/inventory-items/${id}/adjust`, { adjustment, note }).then((r) => r.data),
};

export function useInventoryList(params: { skipCount?: number; maxResultCount?: number; filter?: string } = {}) {
  return useQuery({
    queryKey: ["inventory", params],
    queryFn: () => inventoryApi.list(params),
  });
}

export function useInventoryItem(id: string) {
  return useQuery({
    queryKey: ["inventory", id],
    queryFn: () => inventoryApi.get(id),
    enabled: Boolean(id),
  });
}

export function useAdjustStock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, adjustment, note }: { id: string; adjustment: number; note: string }) =>
      inventoryApi.adjustStock(id, adjustment, note),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["inventory"] }),
  });
}
