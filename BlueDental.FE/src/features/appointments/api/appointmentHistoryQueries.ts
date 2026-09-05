import { keepPreviousData, useInfiniteQuery, useMutation, useQuery } from "@tanstack/react-query";
import { appointmentHistoryApi } from "./appointmentHistoryApi";
import type { HistoryFilter, HistoryPage, HistoryPaging } from "../types/appointmentHistory";

export const appointmentHistoryKeys = {
  all: ["appointment-history"] as const,
  list: (filter: HistoryFilter, paging: HistoryPaging) =>
    [...appointmentHistoryKeys.all, "list", filter, paging] as const,
  timeline: (filter: HistoryFilter, pageSize: number) =>
    [...appointmentHistoryKeys.all, "timeline", filter, pageSize] as const,
  stats: (filter: HistoryFilter) => [...appointmentHistoryKeys.all, "stats", filter] as const,
};

/**
 * History is written by every appointment change, so it is never trusted
 * from cache: each time the dialog asks, the server answers.
 */
export function useAppointmentHistoryList(filter: HistoryFilter, paging: HistoryPaging, enabled = true) {
  return useQuery({
    queryKey: appointmentHistoryKeys.list(filter, paging),
    queryFn: () => appointmentHistoryApi.list(filter, paging),
    enabled: enabled && Boolean(filter.patientId),
    staleTime: 0,
    placeholderData: keepPreviousData,
  });
}

function loadedCount(pages: HistoryPage[]): number {
  return pages.reduce((count, page) => count + page.items.length, 0);
}

/**
 * The same rows read page after page for Dòng thời gian, which keeps every
 * page it has seen and asks for the next one as it is scrolled.
 */
export function useAppointmentHistoryTimeline(filter: HistoryFilter, pageSize: number, enabled = true) {
  return useInfiniteQuery({
    queryKey: appointmentHistoryKeys.timeline(filter, pageSize),
    queryFn: ({ pageParam }) =>
      appointmentHistoryApi.list(filter, { skipCount: pageParam, maxResultCount: pageSize }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      const loaded = loadedCount(allPages);
      return loaded < lastPage.totalCount ? loaded : undefined;
    },
    enabled: enabled && Boolean(filter.patientId),
    staleTime: 0,
    placeholderData: keepPreviousData,
  });
}

export function useAppointmentHistoryStats(filter: HistoryFilter) {
  return useQuery({
    queryKey: appointmentHistoryKeys.stats(filter),
    queryFn: () => appointmentHistoryApi.stats(filter),
    enabled: Boolean(filter.patientId),
    staleTime: 0,
    placeholderData: keepPreviousData,
  });
}

/** Pulls every row matching the current filter, for the export menu. */
export function useExportAppointmentHistory() {
  return useMutation({
    mutationKey: ["appointment-history", "export"],
    mutationFn: (filter: HistoryFilter) => appointmentHistoryApi.listAll(filter),
  });
}
