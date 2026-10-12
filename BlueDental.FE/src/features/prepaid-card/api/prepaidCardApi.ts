import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/axios";
import { useBranchFilter, useCurrentBranchId } from "@/lib/clinicBranch";
import type { PagedResult } from "@/types";
import type {
  CardDetailDto,
  CardDto,
  CardListFilter,
  CardSummaryDto,
  CardTypeDto,
  MembersInput,
  SaveCardTypeInput,
  SellCardInput,
  TopupCardInput,
} from "../types";

/**
 * Thẻ trả trước (cụm 3). BlueDental-local. The server owns every rule — the
 * balance, the uses, who may spend a card and on what — the screen only shows
 * the figures and sends what was typed.
 */

const BASE = "/v1/app/prepaid-cards";

export const prepaidCardKeys = {
  all: ["prepaid-cards"] as const,
  types: (branchId: string | undefined, onSaleOnly: boolean) =>
    [...prepaidCardKeys.all, "types", branchId ?? "all", onSaleOnly] as const,
  list: (branchId: string | undefined, filter: CardListFilter) =>
    [...prepaidCardKeys.all, "list", branchId ?? "all", filter] as const,
  summary: (branchId: string | undefined) => [...prepaidCardKeys.all, "summary", branchId ?? "all"] as const,
  detail: (id: string) => [...prepaidCardKeys.all, "detail", id] as const,
};

export function useCardTypes(onSaleOnly = false) {
  const branchId = useBranchFilter();
  return useQuery({
    queryKey: prepaidCardKeys.types(branchId, onSaleOnly),
    queryFn: async () =>
      (
        await api.get<{ items: CardTypeDto[] }>(`${BASE}/types`, {
          params: { ClinicBranchId: branchId, OnSaleOnly: onSaleOnly },
        })
      ).data.items,
  });
}

export function useCards(filter: CardListFilter) {
  const branchId = useBranchFilter();
  return useQuery({
    queryKey: prepaidCardKeys.list(branchId, filter),
    queryFn: async () =>
      (
        await api.get<PagedResult<CardDto>>(BASE, {
          params: {
            ClinicBranchId: branchId,
            Filter: filter.filter || undefined,
            State: filter.state,
            CardTypeId: filter.cardTypeId,
            SkipCount: filter.skipCount,
            MaxResultCount: filter.maxResultCount,
          },
        })
      ).data,
    placeholderData: keepPreviousData,
  });
}

export function useCardSummary() {
  const branchId = useBranchFilter();
  return useQuery({
    queryKey: prepaidCardKeys.summary(branchId),
    queryFn: async () =>
      (await api.get<CardSummaryDto>(`${BASE}/summary`, { params: { ClinicBranchId: branchId } })).data,
  });
}

export function useCardDetail(id: string | null) {
  return useQuery({
    queryKey: prepaidCardKeys.detail(id ?? "none"),
    queryFn: async () => (await api.get<CardDetailDto>(`${BASE}/${id}`)).data,
    enabled: Boolean(id),
  });
}

/** Every write the screen makes; each refreshes the whole feature once the server answers. */
export function useCardCommands() {
  const queryClient = useQueryClient();
  const branchId = useCurrentBranchId();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: prepaidCardKeys.all });

  const createType = useMutation({
    mutationFn: (input: SaveCardTypeInput) =>
      api.post<CardTypeDto>(`${BASE}/types`, { ...input, clinicBranchId: branchId }).then((r) => r.data),
    onSuccess: invalidate,
  });
  const updateType = useMutation({
    mutationFn: ({ id, input }: { id: string; input: SaveCardTypeInput }) =>
      api.put<CardTypeDto>(`${BASE}/types/${id}`, input).then((r) => r.data),
    onSuccess: invalidate,
  });
  const deleteType = useMutation({
    mutationFn: (id: string) => api.delete(`${BASE}/types/${id}`).then(() => undefined),
    onSuccess: invalidate,
  });
  const sell = useMutation({
    mutationFn: (input: SellCardInput) =>
      api.post<CardDetailDto>(BASE, { ...input, clinicBranchId: branchId }).then((r) => r.data),
    onSuccess: invalidate,
  });
  const topup = useMutation({
    mutationFn: ({ id, input }: { id: string; input: TopupCardInput }) =>
      api.post<CardDetailDto>(`${BASE}/${id}/topup`, input).then((r) => r.data),
    onSuccess: invalidate,
  });
  const setMembers = useMutation({
    mutationFn: ({ id, ...input }: { id: string } & MembersInput) =>
      api.put<CardDetailDto>(`${BASE}/${id}/members`, input).then((r) => r.data),
    onSuccess: invalidate,
  });
  const setLocked = useMutation({
    mutationFn: ({ id, locked }: { id: string; locked: boolean }) =>
      api.post<CardDetailDto>(`${BASE}/${id}/${locked ? "lock" : "unlock"}`).then((r) => r.data),
    onSuccess: invalidate,
  });

  const cancel = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api.post<CardDetailDto>(`${BASE}/${id}/cancel`, { reason }).then((r) => r.data),
    onSuccess: invalidate,
  });

  return { createType, updateType, deleteType, sell, topup, setMembers, setLocked, cancel };
}
