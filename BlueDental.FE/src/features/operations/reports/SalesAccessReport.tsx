import { useMemo, useState } from "react";
import { CheckCircleOutlined, RiseOutlined, StarOutlined } from "@ant-design/icons";
import {
  SALES_CATEGORY,
  useSalesAccess,
  type SalesCategory,
  type ServiceLineRow,
} from "../api/operationReportApi";
import { OperationsPeriodBar } from "./OperationsPeriodBar";
import { OperationsStatCards, type StatCard } from "./OperationsStatCards";
import { salesAccessColumns } from "./serviceLineColumns";
import { usePeriodRange } from "./usePeriodRange";
import { DataTable } from "@/components/DataTable";
import { useTablePagination } from "@/hooks/useTablePagination";
import { t } from "@/lib/i18n";
import { formatMoney } from "./formatMoney";

/**
 * Khối điều trị / Khối tài chính → Truy cập.
 *
 * The same service lines as Hoàn thành theo dịch vụ, through every column the
 * reference shows, with three figures that double as the filter: picking a card
 * narrows the list to it.
 */
export function SalesAccessReport() {
  const range = usePeriodRange("month");
  const pagination = useTablePagination(20);
  const [category, setCategory] = useState<SalesCategory>(SALES_CATEGORY.total);

  const query = useSalesAccess(
    {
      periodCode: range.periodCode,
      anchorIso: range.anchorIso,
      skipCount: pagination.skipCount,
      maxResultCount: pagination.maxResultCount,
    },
    { Category: category },
  );

  const stats = query.data?.stats;

  const pick = (next: SalesCategory) => {
    setCategory(next);
    pagination.resetToFirstPage();
  };

  const cards = useMemo<StatCard[]>(
    () => [
      {
        key: "total",
        value: formatMoney(stats?.totalSales ?? 0),
        label: t("Tổng doanh số"),
        icon: <RiseOutlined />,
        tone: "green",
        active: category === SALES_CATEGORY.total,
        onSelect: () => pick(SALES_CATEGORY.total),
      },
      {
        key: "completed",
        value: formatMoney(stats?.completedServices ?? 0),
        label: t("Dịch vụ đã hoàn thành"),
        icon: <CheckCircleOutlined />,
        tone: "blue",
        active: category === SALES_CATEGORY.completed,
        onSelect: () => pick(SALES_CATEGORY.completed),
      },
      {
        key: "ownQuota",
        value: formatMoney(stats?.ownQuotaServices ?? 0),
        label: t("Dịch vụ tính doanh số riêng"),
        icon: <StarOutlined />,
        tone: "rose",
        active: category === SALES_CATEGORY.ownQuota,
        onSelect: () => pick(SALES_CATEGORY.ownQuota),
      },
    ],
    // pick is stable enough for this: it only closes over two setters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [stats, category],
  );

  const columns = useMemo(() => salesAccessColumns(), []);

  return (
    <div className="bd-ops-report-screen">
      <div className="bd-ops-report-bar">
        <OperationsPeriodBar range={range} periods={["day", "week", "month"]} />
      </div>

      <OperationsStatCards cards={cards} />

      <div className="bd-cat-card">
        <DataTable<ServiceLineRow>
          columns={columns}
          dataSource={query.data?.items ?? []}
          rowKey="id"
          loading={query.isFetching}
          scroll={{ x: 3600 }}
          pagination={pagination.buildConfig(
            query.data?.totalCount ?? 0,
            (total, rangeOf) =>
              total === 0
                ? t("Hiển thị 0 trên 0 doanh số")
                : t("Hiển thị {0}–{1} trên {2} doanh số", rangeOf[0], rangeOf[1], total),
          )}
          locale={{ emptyText: t("Không có dữ liệu") }}
        />
      </div>
    </div>
  );
}
