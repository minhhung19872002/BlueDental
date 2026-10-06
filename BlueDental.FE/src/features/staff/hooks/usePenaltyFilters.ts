import { useMemo, useState } from "react";
import type { Dayjs } from "dayjs";
import { useDebounce } from "@/hooks/useDebounce";
import { useTablePagination } from "@/hooks/useTablePagination";
import type { StaffPenaltyQuery } from "../api/staffPenaltyApi";
import type { StatusFilterKey } from "../components/penalty/penaltyConfig";

export type DateRange = [Dayjs | null, Dayjs | null] | null;

/**
 * The Chế tài list's filters — search, status pill, violation-date range — and
 * its page. Any filter change goes back to page one; the server does the rest.
 */
export function usePenaltyFilters() {
  const [keyword, setKeyword] = useState("");
  const [status, setStatusState] = useState<StatusFilterKey>("all");
  const [range, setRangeState] = useState<DateRange>(null);
  const pagination = useTablePagination(20);
  const debouncedKeyword = useDebounce(keyword.slice(0, 100), 400);

  const query = useMemo<StaffPenaltyQuery>(
    () => ({
      filter: debouncedKeyword,
      status: status === "all" ? undefined : status,
      fromDate: range?.[0]?.format("YYYY-MM-DD"),
      toDate: range?.[1]?.format("YYYY-MM-DD"),
      skipCount: pagination.skipCount,
      maxResultCount: pagination.maxResultCount,
    }),
    [debouncedKeyword, status, range, pagination.skipCount, pagination.maxResultCount],
  );

  const changeKeyword = (value: string) => {
    setKeyword(value);
    pagination.resetToFirstPage();
  };
  const setStatus = (value: StatusFilterKey) => {
    setStatusState(value);
    pagination.resetToFirstPage();
  };
  const setRange = (value: DateRange) => {
    setRangeState(value);
    pagination.resetToFirstPage();
  };

  return { keyword, changeKeyword, status, setStatus, range, setRange, pagination, query };
}
