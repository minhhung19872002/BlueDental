import { useEffect, useRef, type ReactNode } from "react";
import { Spin } from "antd";
import { t } from "@/lib/i18n";

export interface AdviseColumn {
  key: string;
  /** An i18n key. */
  label: string;
  align?: "end" | "center";
}

interface Props {
  /** "am-table--single" or "am-table--combo": sets the column widths. */
  variant: "single" | "combo";
  columns: readonly AdviseColumn[];
  /** The tick-all box of the head's first cell. */
  headCheck: ReactNode;
  rowCount: number;
  loading: boolean;
  loadingMore?: boolean;
  hasMore?: boolean;
  emptyText: string;
  onLoadMore?: () => void;
  children: ReactNode;
}

/**
 * The scrolling table of "Chọn dịch vụ" (P0111_02, R-1114), shared by the
 * Dịch vụ lẻ and Combo tabs: a sticky head, the rows, a spinner while the
 * first page loads and the next page asked for as the bottom comes into view.
 */
export function AdviseTableShell({
  variant,
  columns,
  headCheck,
  rowCount,
  loading,
  loadingMore = false,
  hasMore = false,
  emptyText,
  onLoadMore,
  children,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore || !onLoadMore || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !loadingMore) onLoadMore();
      },
      { root: scrollRef.current, threshold: 0.1 },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, onLoadMore, rowCount]);

  const span = columns.length + 1;
  return (
    <div className="am-table-scroll" ref={scrollRef}>
      <table className={`am-table am-table--${variant}`}>
        <colgroup>
          <col className="am-col-check" />
          {columns.map((column) => (
            <col key={column.key} className={`am-col-${column.key}`} />
          ))}
        </colgroup>
        <thead>
          <tr>
            <th className="am-cell-check">{headCheck}</th>
            {columns.map((column) => (
              <th key={column.key} className={column.align ? `am-th--${column.align}` : undefined}>
                {t(column.label)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading && (
            <tr>
              <td colSpan={span} className="am-empty">
                <Spin size="small" />
              </td>
            </tr>
          )}
          {!loading && rowCount === 0 && (
            <tr>
              <td colSpan={span} className="am-empty">
                {emptyText}
              </td>
            </tr>
          )}
          {!loading && children}
        </tbody>
      </table>
      {loadingMore && (
        <div className="am-more">
          <Spin size="small" />
        </div>
      )}
      <div ref={sentinelRef} className="am-sentinel" />
    </div>
  );
}
