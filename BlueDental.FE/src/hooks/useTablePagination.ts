import { useState } from "react";
import type { TablePaginationConfig } from "antd";
import { t } from "@/lib/i18n";

const BASE_PAGE_SIZE_OPTIONS = [10, 20, 50, 100];
const DEFAULT_PAGE_SIZE = 20;

export interface TablePagination {
  page: number;
  pageSize: number;
  skipCount: number;
  maxResultCount: number;
  resetToFirstPage: () => void;
  buildConfig: (
    total?: number,
    /** Same shape antd expects, so a caller can name what it is counting. */
    showTotal?: TablePaginationConfig["showTotal"],
  ) => TablePaginationConfig;
}

export function useTablePagination(
  defaultPageSize: number = DEFAULT_PAGE_SIZE,
): TablePagination {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultPageSize);

  const pageSizeOptions = [
    ...new Set([...BASE_PAGE_SIZE_OPTIONS, defaultPageSize]),
  ].sort((a, b) => a - b);

  const handleChange = (nextPage: number, nextPageSize: number) => {
    if (nextPageSize !== pageSize) {
      setPageSize(nextPageSize);
      setPage(1);
      return;
    }
    setPage(nextPage);
  };

  return {
    page,
    pageSize,
    skipCount: (page - 1) * pageSize,
    maxResultCount: pageSize,
    resetToFirstPage: () => setPage(1),
    buildConfig: (total, showTotal) => ({
      current: page,
      pageSize,
      total: total ?? 0,
      showSizeChanger: true,
      pageSizeOptions,
      onChange: handleChange,
      showTotal:
        showTotal ??
        ((totalCount, range) =>
          t("Hiển thị {0}-{1}/{2}", range[0], range[1], totalCount)),
    }),
  };
}
