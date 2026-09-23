import { useQuery } from "@tanstack/react-query";
import { queueApi } from "./queueApi";
import type { QueueListQuery } from "../types";

export const queueKeys = {
  all: ["queue"] as const,
  lists: () => [...queueKeys.all, "list"] as const,
  list: (params: QueueListQuery) => [...queueKeys.lists(), params] as const,
  details: () => [...queueKeys.all, "detail"] as const,
  detail: (id: string) => [...queueKeys.details(), id] as const,
  statsBase: () => [...queueKeys.all, "stats"] as const,
  stats: (date?: string, counterId?: string) =>
    [...queueKeys.all, "stats", date, counterId] as const,
  counters: () => [...queueKeys.all, "counters"] as const,
  display: (branchId: string, counterId?: string) =>
    [...queueKeys.all, "display", branchId, counterId] as const,
};

export function useQueueList(params: QueueListQuery) {
  return useQuery({
    queryKey: queueKeys.list(params),
    queryFn: () => queueApi.list(params),
  });
}

export function useQueueTicket(id: string) {
  return useQuery({
    queryKey: queueKeys.detail(id),
    queryFn: () => queueApi.get(id),
    enabled: Boolean(id),
  });
}

export function useQueueStats(date?: string, counterId?: string) {
  return useQuery({
    queryKey: queueKeys.stats(date, counterId),
    queryFn: () => queueApi.stats(date, counterId),
    refetchInterval: 30_000,
  });
}

export function useQueueCounters() {
  return useQuery({
    queryKey: queueKeys.counters(),
    queryFn: () => queueApi.getCounters(),
  });
}

export function useQueueDisplay(branchId: string, counterId?: string) {
  return useQuery({
    queryKey: queueKeys.display(branchId, counterId),
    queryFn: () => queueApi.display(branchId, counterId),
    enabled: Boolean(branchId),
    refetchInterval: 10_000,
  });
}
