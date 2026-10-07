import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
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

/** Ticket File's "xem ticket của file" link: /marketing/tickets?file=<id>. */
const FILE_PARAM = "file";

/** True when anything differs from the untouched screen — what "Xoá bộ lọc" undoes. */
function hasFilters(state: TicketFilterState, importFileId: string | undefined): boolean {
  return Boolean(
    state.keyword ||
      state.tab !== "all" ||
      state.period.mode ||
      state.tagId ||
      state.assignee ||
      state.sourceTaxonomyId ||
      importFileId,
  );
}

/** The server filter for a screen state; the status tab is the status / attention half of it. */
function toFilter(state: TicketFilterState, keyword: string, importFileId: string | undefined): TicketFilter {
  const range = periodRange(state.period);
  return {
    filter: keyword,
    ...statusTabFilter(state.tab),
    tagId: state.tagId,
    assignee: state.assignee,
    sourceTaxonomyId: state.sourceTaxonomyId,
    fromDate: range?.from,
    toDate: range?.to,
    importFileId,
  };
}

/**
 * The Ticket list's filters and its page. Any filter change goes back to page
 * one; the server does the filtering. The Ticket File filter lives in the URL,
 * so the file list can link to it.
 */
export function useTicketFilters(options: { deleted?: boolean } = {}) {
  const [state, setState] = useState<TicketFilterState>(empty);
  const [searchParams, setSearchParams] = useSearchParams();
  const importFileId = searchParams.get(FILE_PARAM) ?? undefined;
  const pagination = useTablePagination(20);
  const debouncedKeyword = useDebounce(state.keyword.slice(0, 100), 400);

  const filter = useMemo(
    () => toFilter(state, debouncedKeyword, importFileId),
    [state, debouncedKeyword, importFileId],
  );
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
  const clearFile = () => {
    setSearchParams((params) => {
      params.delete(FILE_PARAM);
      return params;
    }, { replace: true });
    pagination.resetToFirstPage();
  };
  const reset = () => {
    setState(empty());
    clearFile();
  };

  return {
    state,
    patch,
    reset,
    importFileId,
    clearFile,
    isFiltered: hasFilters(state, importFileId),
    filter,
    query,
    pagination,
  };
}
