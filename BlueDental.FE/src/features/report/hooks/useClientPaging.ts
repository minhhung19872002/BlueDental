import { useCallback, useMemo, useState } from "react";

/** Client-side paging for demo tables so row-span grouping never bleeds across pages. */
export function useClientPaging<T>(rows: T[], initialPageSize = 20) {
  const [requestedPage, setRequestedPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);

  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const page = Math.min(requestedPage, pageCount);

  const pageRows = useMemo(
    () => rows.slice((page - 1) * pageSize, page * pageSize),
    [rows, page, pageSize],
  );

  const handlePageChange = useCallback((nextPage: number, nextSize: number) => {
    setRequestedPage(nextPage);
    setPageSize(nextSize);
  }, []);

  return { page, pageSize, pageRows, totalCount: rows.length, onPageChange: handlePageChange };
}
