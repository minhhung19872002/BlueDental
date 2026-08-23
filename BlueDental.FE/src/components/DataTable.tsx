// DataTable — thin wrapper around Ant Design Table with BlueDental defaults.
// Adds consistent scroll, pagination format, and loading skeleton.

import { Table, type TableProps } from "antd";
import { useTranslation } from "react-i18next";

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
  const { t } = useTranslation();
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
            t("common.showRange", { from: range[0], to: range[1], total }),
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
