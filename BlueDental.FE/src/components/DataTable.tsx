// DataTable — thin wrapper around Ant Design Table with BlueDental defaults.
// Adds consistent scroll, pagination format, and loading skeleton.

import { Table, type TableProps } from "antd";
import { t } from "@/lib/i18n";

interface Props<T extends object> extends TableProps<T> {
  totalCount?: number;
  page?: number;
  pageSize?: number;
  onPageChange?: (page: number, pageSize: number) => void;
}

export function DataTable<T extends object>({
  totalCount,
  page,
  pageSize,
  onPageChange,
  pagination,
  ...rest
}: Props<T>) {
  const paginationConfig =
    pagination === false
      ? false
      : {
          current: page,
          pageSize,
          total: totalCount ?? 0,
          showSizeChanger: true,
          pageSizeOptions: [10, 20, 50, 100],
          onChange: onPageChange,
          showTotal: (total: number, range: [number, number]) =>
            t("Hiển thị {0}–{1} trên {2} dòng", range[0], range[1], total),
          ...pagination,
        };

  return (
    <Table<T>
      scroll={{ x: "max-content" }}
      pagination={paginationConfig}
      {...rest}
    />
  );
}
