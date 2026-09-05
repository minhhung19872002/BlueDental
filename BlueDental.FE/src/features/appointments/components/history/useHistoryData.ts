import { useCallback } from "react";
import {
  useAppointmentHistoryList,
  useAppointmentHistoryTimeline,
} from "../../api/appointmentHistoryQueries";
import type { HistoryEntry, HistoryFilter, HistoryPaging } from "../../types/appointmentHistory";
import type { HistoryView } from "./historyLabels";

export interface HistoryData {
  entries: HistoryEntry[];
  total: number;
  /** Nothing to show yet: the first answer for this view is still on its way. */
  loading: boolean;
  hasMore: boolean;
  loadingMore: boolean;
  loadMore: () => void;
}

const NONE = () => undefined;

/**
 * The rows behind whichever view is open. Bảng reads one page at a time and
 * walks it with the footer; Dòng thời gian keeps every page read so far and
 * asks for the next one as it is scrolled. Only the open view's query runs.
 */
export function useHistoryData(filter: HistoryFilter, paging: HistoryPaging, view: HistoryView): HistoryData {
  const table = useAppointmentHistoryList(filter, paging, view === "table");
  const timeline = useAppointmentHistoryTimeline(filter, paging.maxResultCount, view === "timeline");

  const { hasNextPage, isFetchingNextPage, isPlaceholderData, fetchNextPage } = timeline;
  const loadMore = useCallback(() => {
    // Placeholder pages belong to the previous filter; wait for the real ones.
    if (hasNextPage && !isFetchingNextPage && !isPlaceholderData) void fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, isPlaceholderData, fetchNextPage]);

  if (view === "table") {
    return {
      entries: table.data?.items ?? [],
      total: table.data?.totalCount ?? 0,
      loading: table.isPending,
      hasMore: false,
      loadingMore: false,
      loadMore: NONE,
    };
  }

  const pages = timeline.data?.pages ?? [];
  return {
    entries: pages.flatMap((page) => page.items),
    total: pages[0]?.totalCount ?? 0,
    loading: timeline.isPending,
    hasMore: hasNextPage,
    loadingMore: isFetchingNextPage,
    loadMore,
  };
}
