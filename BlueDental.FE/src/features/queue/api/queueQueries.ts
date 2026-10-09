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
  board: () => [...queueKeys.all, "board"] as const,
  counterQueues: () => [...queueKeys.all, "counterQueue"] as const,
  counterQueue: (id: string) => [...queueKeys.counterQueues(), id] as const,
  displayBoard: (branchId: string) => [...queueKeys.all, "displayBoard", branchId] as const,
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

/** The counter cards on the main screen; SignalR invalidates it, polling covers a dropped socket. */
export function useCounterBoard() {
  return useQuery({
    queryKey: queueKeys.board(),
    queryFn: () => queueApi.board(),
    refetchInterval: 10_000,
  });
}

/** One counter's waiting list ("Hàng chờ · Quầy …"); waited minutes move, so it polls too. */
export function useCounterQueue(id: string) {
  return useQuery({
    queryKey: queueKeys.counterQueue(id),
    queryFn: () => queueApi.counterQueue(id),
    enabled: Boolean(id),
    refetchInterval: 10_000,
  });
}

export function useDisplayBoard(branchId: string) {
  return useQuery({
    queryKey: queueKeys.displayBoard(branchId),
    queryFn: () => queueApi.displayBoard(branchId),
    enabled: Boolean(branchId),
    refetchInterval: 10_000,
  });
}
