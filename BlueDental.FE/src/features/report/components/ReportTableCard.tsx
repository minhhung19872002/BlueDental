import type { TableProps } from "antd";
import { DataTable } from "@/components/DataTable";

interface Props<T extends object> extends TableProps<T> {
  totalCount?: number;
  page?: number;
  pageSize?: number;
  onPageChange?: (page: number, pageSize: number) => void;
  className?: string;
}

/**
 * Bordered table block used across the report. The pager is the shared
 * DataTable one, so it reads the same as every other list in the app.
 */
export function ReportTableCard<T extends object>({ className, ...rest }: Props<T>) {
  return (
    <div className={["report-table-card", className].filter(Boolean).join(" ")}>
      <DataTable<T> {...rest} />
    </div>
  );
}
