import type { ReactNode } from "react";
import { Pagination, type TablePaginationConfig, type TableProps } from "antd";
import { DataTable } from "@/components/DataTable";
import { t } from "@/lib/i18n";

interface Props<T extends object> extends TableProps<T> {
  totalCount?: number;
  page?: number;
  pageSize?: number;
  onPageChange?: (page: number, pageSize: number) => void;
  className?: string;
  /** What a row is called in the pager total: "dòng" (default), "phiếu", "giao dịch". */
  countUnit?: string;
}

/** The reference's page-size menu on every report table (20 selected by default). */
export const REPORT_PAGE_SIZE_OPTIONS = [5, 10, 20, 25, 50, 100];

/** The reference labels its pager arrows "Trước" / "Sau" instead of icons. */
function renderPagerItem(_page: number, type: "page" | "prev" | "next" | "jump-prev" | "jump-next", original: ReactNode) {
  if (type === "prev") return <span className="report-pager-step">{t("Report:Pagination:Prev")}</span>;
  if (type === "next") return <span className="report-pager-step">{t("Report:Pagination:Next")}</span>;
  return original;
}

/** "Hiển thị 1–20 trên 45 phiếu", or "Hiển thị 0 trên 0 phiếu" on an empty table, as the reference words it. */
export function reportShowTotal(countUnit: string): NonNullable<TablePaginationConfig["showTotal"]> {
  return (total, range) =>
    total === 0
      ? t("Common:Pager:ShowZeroUnit", countUnit)
      : t("Common:Pager:ShowRangeUnit", range[0], range[1], total, countUnit);
}

/** Pager pieces every report table shares; a caller's own `pagination` still wins field by field. */
export function reportPagination(countUnit: string, override?: TablePaginationConfig): TablePaginationConfig {
  return {
    pageSizeOptions: REPORT_PAGE_SIZE_OPTIONS,
    itemRender: renderPagerItem,
    showTotal: reportShowTotal(countUnit),
    ...override,
  };
}

/**
 * Bordered table block used across the report. The pager is the shared
 * DataTable one, dressed the way the reference dresses it: 5…100 / trang,
 * "Hiển thị N trên M dòng", Trước / Sau. Ant Design drops the pager on an
 * empty table while the reference keeps it, so an empty table gets its own.
 */
export function ReportTableCard<T extends object>({
  className,
  countUnit,
  pagination,
  totalCount,
  page,
  pageSize,
  onPageChange,
  ...rest
}: Props<T>) {
  const unit = countUnit ?? t("Report:Unit:Row");
  const pagerConfig = pagination === false ? false : reportPagination(unit, pagination);
  const total = pagination === false ? undefined : (pagination?.total ?? totalCount ?? 0);
  const showEmptyPager = pagerConfig !== false && total === 0;

  return (
    <div className={["report-table-card", className].filter(Boolean).join(" ")}>
      <DataTable<T>
        {...rest}
        totalCount={totalCount}
        page={page}
        pageSize={pageSize}
        onPageChange={onPageChange}
        pagination={pagerConfig}
        locale={{ emptyText: t("Common:NoData"), ...rest.locale }}
      />
      {showEmptyPager && (
        <Pagination
          className="report-empty-pager"
          align="end"
          current={pagerConfig.current ?? page ?? 1}
          pageSize={pagerConfig.pageSize ?? pageSize ?? 20}
          total={0}
          showSizeChanger
          pageSizeOptions={pagerConfig.pageSizeOptions}
          itemRender={pagerConfig.itemRender}
          showTotal={pagerConfig.showTotal}
          onChange={pagerConfig.onChange ?? onPageChange}
        />
      )}
    </div>
  );
}
