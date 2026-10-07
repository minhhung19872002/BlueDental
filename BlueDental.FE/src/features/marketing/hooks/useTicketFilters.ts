import { useMemo, useState } from "react";
import { periodRange, type Period } from "@/components/PeriodPicker";
import { useDebounce } from "@/hooks/useDebounce";
import { useTablePagination } from "@/hooks/useTablePagination";
import type { TicketFilter, TicketQuery } from "../api/ticketApi";
import { statusTabFilter, type StatusTabKey } from "../ticketTabs";

/** Everything the Ticket screen filters by. */
export interface TicketFilterState {
  keyword: string;
  tab: StatusTabKey;
  /** Ngày nhận, as Ngày / Tuần / Tháng; no mode = any day. */
  period: Period;
  tagId?: string;
  assignee?: string;
  sourceTaxonomyId?: string;
}

const empty = (): TicketFilterState => ({ keyword: "", tab: "all", period: { mode: null, anchor: new Date() } });

/** True when anything differs from the untouched screen — what "Xoá bộ lọc" undoes. */
function hasFilters(state: TicketFilterState): boolean {
  return Boolean(
    state.keyword || state.tab !== "all" || state.period.mode || state.tagId || state.assignee || state.sourceTaxonomyId,
  );
}

/** The server filter for a screen state; the status tab is the status / attention half of it. */
function toFilter(state: TicketFilterState, keyword: string): TicketFilter {
  const range = periodRange(state.period);
  return {
    filter: keyword,
    ...statusTabFilter(state.tab),
    tagId: state.tagId,
    assignee: state.assignee,
    sourceTaxonomyId: state.sourceTaxonomyId,
    fromDate: range?.from,
    toDate: range?.to,
  };
}

/**
 * The Ticket list's filters and its page. Any filter change goes back to page
 * one; the server does the filtering.
 */
export function useTicketFilters(options: { deleted?: boolean } = {}) {
  const [state, setState] = useState<TicketFilterState>(empty);
  const pagination = useTablePagination(20);
  const debouncedKeyword = useDebounce(state.keyword.slice(0, 100), 400);

  const filter = useMemo(() => toFilter(state, debouncedKeyword), [state, debouncedKeyword]);
  const query = useMemo<TicketQuery>(
    () => ({
      ...filter,
      deleted: options.deleted,
      skipCount: pagination.skipCount,
      maxResultCount: pagination.maxResultCount,
    }),
    [filter, options.deleted, pagination.skipCount, pagination.maxResultCount],
  );

  const patch = (change: Partial<TicketFilterState>) => {
    setState((current) => ({ ...current, ...change }));
    pagination.resetToFirstPage();
  };
  const reset = () => {
    setState(empty());
    pagination.resetToFirstPage();
  };

  return {
    state,
    patch,
    reset,
    isFiltered: hasFilters(state),
    filter,
    query,
    pagination,
  };
}
