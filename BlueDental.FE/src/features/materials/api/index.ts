import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/axios";
import type { PagedResult } from "@/types";
import { useCurrentBranchId } from "@/lib/clinicBranch";

// ── DTOs ──────────────────────────────────────────────────────────────────

export interface InventoryItemDto {
  id: string;
  itemCode: string;
  name: string;
  category?: string;
  unit?: string;
  quantityOnHand: number;
  reorderLevel: number;
  needsReorder: boolean;
  branchId: string;
  isActive: boolean;
  creationTime: string;
  lastModificationTime?: string;
}

export interface CreateInventoryItemDto {
  itemCode: string;
  name: string;
  description?: string;
  category?: string;
  unit?: string;
  reorderLevel: number;
  unitCost?: number;
  branchId: string;
}

export interface UpdateInventoryItemDto {
  name: string;
  category?: string;
  unit?: string;
  reorderLevel: number;
  unitCost?: number;
}

// ── API ───────────────────────────────────────────────────────────────────

const inventoryApi = {
  list: (params?: {
    filter?: string;
    branchId?: string;
    needsReorder?: boolean;
    skipCount?: number;
    maxResultCount?: number;
  }): Promise<PagedResult<InventoryItemDto>> =>
    api.get("/v1/app/inventory-items", { params }).then((r) => r.data),

  get: (id: string): Promise<InventoryItemDto> =>
    api.get(`/v1/app/inventory-items/${id}`).then((r) => r.data),

  create: (data: CreateInventoryItemDto): Promise<InventoryItemDto> =>
    api.post("/v1/app/inventory-items", data).then((r) => r.data),

  update: (id: string, data: UpdateInventoryItemDto): Promise<InventoryItemDto> =>
    api.put(`/v1/app/inventory-items/${id}`, data).then((r) => r.data),

  /**
   * Điều chỉnh tồn. The server routes by movement type: Purchase adds,
   * Consumption takes away, so the design's − and + map onto real movements
   * rather than a raw quantity write.
   */
  adjustStock: (id: string, data: { movementType: number; quantity: number; notes?: string }): Promise<InventoryItemDto> =>
    api.post(`/v1/app/inventory-items/${id}/adjust-stock`, data).then((r) => r.data),

  delete: (id: string): Promise<void> =>
    api.delete(`/v1/app/inventory-items/${id}`).then((r) => r.data),
};

// ── Hooks ─────────────────────────────────────────────────────────────────

export function useInventoryItemList(params?: { filter?: string; needsReorder?: boolean }) {
  const branchId = useCurrentBranchId();
  return useQuery({
    queryKey: ["inventory-items", branchId, params],
    queryFn: () =>
      inventoryApi.list({
        ...params,
        branchId,
        maxResultCount: 200,
      }),
  });
}

export function useCreateInventoryItem() {
  const branchId = useCurrentBranchId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<CreateInventoryItemDto, "branchId">) =>
      inventoryApi.create({ ...data, branchId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["inventory-items"] }),
  });
}

export function useUpdateInventoryItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateInventoryItemDto }) =>
      inventoryApi.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["inventory-items"] }),
  });
}

/** Movement codes as the server declares them in StockMovementType. */
export const STOCK_MOVEMENT = { Purchase: 1, Consumption: 2 } as const;

export function useAdjustInventoryStock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, movementType, quantity }: { id: string; movementType: number; quantity: number }) =>
      inventoryApi.adjustStock(id, { movementType, quantity }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["inventory-items"] }),
  });
}

export function useDeleteInventoryItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => inventoryApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["inventory-items"] }),
  });
}
