import { createElement, useState, type ReactNode } from "react";
import { t } from "@/lib/i18n";

const BASE_PAGE_SIZE_OPTIONS = [10, 20, 50, 100];
const DEFAULT_PAGE_SIZE = 20;

export interface TablePaginationConfig {
  current: number;
  pageSize: number;
  total: number;
  showSizeChanger: boolean;
  pageSizeOptions: number[];
  onChange: (page: number, pageSize: number) => void;
  showTotal?: (total: number, range: [number, number]) => string;
  itemRender?: (
    current: number,
    type: "prev" | "next" | "page" | "jump-prev" | "jump-next",
    originalElement: ReactNode,
  ) => ReactNode;
}

export interface TablePagination {
  page: number;
  pageSize: number;
  skipCount: number;
  maxResultCount: number;
  resetToFirstPage: () => void;
  buildConfig: (
    total?: number,
    showTotal?: (total: number) => string,
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
      itemRender: (_current, type, originalElement) => {
        if (type === "prev")
          return createElement("span", { className: "pagination-text-btn" }, `< ${t("Trước")}`);
        if (type === "next")
          return createElement("span", { className: "pagination-text-btn" }, `${t("Sau")} >`);
        return originalElement;
      },
    }),
  };
}
