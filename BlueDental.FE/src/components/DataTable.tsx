import type { ReactNode } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/cn";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface DataTableColumn<T> {
  key: string;
  title: string | ReactNode;
  dataIndex?: keyof T & string;
  render?: (value: unknown, record: T, index: number) => ReactNode;
  width?: number | string;
  align?: "left" | "center" | "right";
  fixed?: "left" | "right";
  className?: string;
  ellipsis?: boolean;
}

interface PaginationConfig {
  current: number;
  pageSize: number;
  total: number;
  showSizeChanger?: boolean;
  pageSizeOptions?: number[];
  onChange: (page: number, pageSize: number) => void;
}

interface Props<T> {
  columns: DataTableColumn<T>[];
  dataSource: T[];
  rowKey?: keyof T & string | ((record: T) => string);
  loading?: boolean;
  pagination?: PaginationConfig | false;
  onRow?: (record: T, index: number) => { onClick?: () => void; className?: string };
  className?: string;
  emptyText?: string;
}

function getRowKey<T>(record: T, rowKey: Props<T>["rowKey"], index: number): string {
  if (!rowKey) return String(index);
  if (typeof rowKey === "function") return rowKey(record);
  return String(record[rowKey]);
}

function getCellValue<T>(record: T, col: DataTableColumn<T>, index: number): ReactNode {
  const raw = col.dataIndex ? (record as Record<string, unknown>)[col.dataIndex] : undefined;
  if (col.render) return col.render(raw, record, index);
  if (raw == null) return "";
  return String(raw);
}

export function DataTable<T>({
  columns,
  dataSource,
  rowKey,
  loading = false,
  pagination,
  onRow,
  className,
  emptyText,
}: Props<T>) {
  const totalPages = pagination ? Math.max(1, Math.ceil(pagination.total / pagination.pageSize)) : 1;
  const rangeStart = pagination ? (pagination.current - 1) * pagination.pageSize + 1 : 0;
  const rangeEnd = pagination ? Math.min(pagination.current * pagination.pageSize, pagination.total) : 0;

  return (
    <div className={cn("w-full", className)}>
      <div className="relative overflow-x-auto">
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60">
            <div className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        )}
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((col) => (
                <TableHead
                  key={col.key}
                  className={cn(col.align === "center" && "text-center", col.align === "right" && "text-right")}
                  style={{ width: col.width, minWidth: typeof col.width === "number" ? col.width : undefined }}
                >
                  {col.title}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {dataSource.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                  {emptyText ?? t("Không có dữ liệu")}
                </TableCell>
              </TableRow>
            ) : (
              dataSource.map((record, index) => {
                const rowProps = onRow?.(record, index);
                return (
                  <TableRow
                    key={getRowKey(record, rowKey, index)}
                    className={cn(rowProps?.onClick && "cursor-pointer", rowProps?.className)}
                    onClick={rowProps?.onClick}
                  >
                    {columns.map((col) => (
                      <TableCell
                        key={col.key}
                        className={cn(
                          col.align === "center" && "text-center",
                          col.align === "right" && "text-right",
                          col.ellipsis && "max-w-[200px] truncate",
                          col.className,
                        )}
                        style={{ width: col.width }}
                      >
                        {getCellValue(record, col, index)}
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {pagination && pagination.total > 0 && (
        <div className="flex items-center justify-between border-t px-4 py-3 text-sm text-muted-foreground">
          <span>
            {t("Hiển thị {0}–{1} trên {2} dòng", rangeStart, rangeEnd, pagination.total)}
          </span>
          <div className="flex items-center gap-2">
            {pagination.showSizeChanger && (
              <Select
                value={String(pagination.pageSize)}
                onValueChange={(v) => pagination.onChange(1, Number(v))}
              >
                <SelectTrigger className="h-8 w-[70px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(pagination.pageSizeOptions ?? [10, 20, 50, 100]).map((size) => (
                    <SelectItem key={size} value={String(size)}>
                      {size}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button
              variant="outline"
              size="icon-xs"
              disabled={pagination.current <= 1}
              onClick={() => pagination.onChange(pagination.current - 1, pagination.pageSize)}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <span className="min-w-[60px] text-center text-xs">
              {pagination.current} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="icon-xs"
              disabled={pagination.current >= totalPages}
              onClick={() => pagination.onChange(pagination.current + 1, pagination.pageSize)}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
