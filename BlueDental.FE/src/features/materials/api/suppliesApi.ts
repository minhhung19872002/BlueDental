import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/axios";
import type { PagedResult } from "@/types";

/** Matches BlueDental.Inventory.SupplyStatus — derived from stock and expiry. */
export const SUPPLY_STATUS = {
  Available: 1,
  LowStock: 2,
  OutOfStock: 3,
  ExpiringSoon: 4,
  Expired: 5,
} as const;
export type SupplyStatus = (typeof SUPPLY_STATUS)[keyof typeof SUPPLY_STATUS];

export const SUPPLY_STATUS_CONFIG: Record<SupplyStatus, { label: string; color: string }> = {
  [SUPPLY_STATUS.Available]: { label: "Còn hàng", color: "green" },
  [SUPPLY_STATUS.LowStock]: { label: "Sắp hết", color: "orange" },
  [SUPPLY_STATUS.OutOfStock]: { label: "Hết hàng", color: "red" },
  [SUPPLY_STATUS.ExpiringSoon]: { label: "Sắp hết hạn", color: "gold" },
  [SUPPLY_STATUS.Expired]: { label: "Hết hạn", color: "red" },
};

export interface SupplyDto {
  id: string;
  itemCode: string;
  name: string;
  description: string | null;
  taxonomyId: string | null;
  taxonomyName: string | null;
  unit: string | null;
  stockedAt: string | null;
  expiryDate: string | null;
  expiryWarningDays: number;
  quantityOnHand: number;
  reorderLevel: number;
  needsReorder: boolean;
  status: SupplyStatus;
  supplier: string | null;
  origin: string | null;
  unitCost: number | null;
  salePrice: number | null;
  branchId: string;
  isActive: boolean;
}

export interface SupplyStatsDto {
  total: number;
  available: number;
  lowStock: number;
  outOfStock: number;
  expiringSoon: number;
  expired: number;
  stockValue: number;
}

export interface SupplyListInput {
  branchId?: string;
  taxonomyId?: string;
  status?: SupplyStatus;
  filter?: string;
  isActive?: boolean;
  skipCount?: number;
  maxResultCount?: number;
}

export interface CreateSupplyInput {
  branchId: string;
  itemCode: string;
  name: string;
  taxonomyId?: string;
  unit?: string;
  reorderLevel: number;
  unitCost?: number | null;
  salePrice?: number | null;
  supplier?: string;
  origin?: string;

  /**
   * The first delivery, entered with the material itself.
   *
   * The reference's own form asks for these, so a material does not have to be
   * saved and then received into separately.
   */
  quantity?: number;
  stockedAt?: string;
  expiryDate?: string;
  expiryWarningDays?: number;
}

export interface UpdateSupplyInput {
  name: string;
  taxonomyId?: string;
  unit?: string;
  reorderLevel: number;
  unitCost?: number | null;
  salePrice?: number | null;
  supplier?: string;
  origin?: string;
}

export interface ReceiveStockInput {
  quantity: number;
  stockedAt: string;
  expiryDate?: string;
  expiryWarningDays?: number;
}

const BASE = "/v1/app/inventory-items";

const suppliesApi = {
  list: (params: SupplyListInput): Promise<PagedResult<SupplyDto>> =>
    api.get<PagedResult<SupplyDto>>(BASE, { params }).then((r) => r.data),

  stats: (params: SupplyListInput): Promise<SupplyStatsDto> =>
    api.get<SupplyStatsDto>(`${BASE}/stats`, { params }).then((r) => r.data),

  create: (input: CreateSupplyInput): Promise<SupplyDto> =>
    api.post<SupplyDto>(BASE, input).then((r) => r.data),

  update: (id: string, input: UpdateSupplyInput): Promise<SupplyDto> =>
    api.put<SupplyDto>(`${BASE}/${id}`, input).then((r) => r.data),

  receive: (id: string, input: ReceiveStockInput): Promise<SupplyDto> =>
    api.post<SupplyDto>(`${BASE}/${id}/receive-stock`, input).then((r) => r.data),

  remove: (id: string): Promise<void> => api.delete(`${BASE}/${id}`).then(() => undefined),
};

export const supplyKeys = {
  all: ["supplies"] as const,
  list: (params: SupplyListInput) => [...supplyKeys.all, "list", params] as const,
  stats: (params: SupplyListInput) => [...supplyKeys.all, "stats", params] as const,
};

export function useSupplies(params: SupplyListInput) {
  return useQuery({
    queryKey: supplyKeys.list(params),
    queryFn: () => suppliesApi.list(params),
  });
}

export function useSupplyStats(params: SupplyListInput) {
  return useQuery({
    queryKey: supplyKeys.stats(params),
    queryFn: () => suppliesApi.stats(params),
  });
}

/** Stock and status move together, so any write invalidates the whole tree. */
function useSupplyMutation<TVariables, TData>(fn: (variables: TVariables) => Promise<TData>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: supplyKeys.all });
    },
  });
}

export function useCreateSupply() {
  return useSupplyMutation((input: CreateSupplyInput) => suppliesApi.create(input));
}

export function useUpdateSupply() {
  return useSupplyMutation(({ id, input }: { id: string; input: UpdateSupplyInput }) =>
    suppliesApi.update(id, input),
  );
}

export function useReceiveStock() {
  return useSupplyMutation(({ id, input }: { id: string; input: ReceiveStockInput }) =>
    suppliesApi.receive(id, input),
  );
}

export function useDeleteSupply() {
  return useSupplyMutation((id: string) => suppliesApi.remove(id));
}
