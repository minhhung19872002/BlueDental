import { useMemo, useState } from "react";
import { Input } from "antd";
import {
  CheckCircleOutlined,
  DollarOutlined,
  RiseOutlined,
  SearchOutlined,
  StarOutlined,
  WalletOutlined,
} from "@ant-design/icons";
import { useServiceCompletion, type ServiceLineRow } from "../api/operationReportApi";
import { OperationsPeriodBar } from "./OperationsPeriodBar";
import { OperationsStatCards, type StatCard } from "./OperationsStatCards";
import { serviceCompletionColumns } from "./serviceLineColumns";
import { usePeriodRange } from "./usePeriodRange";
import { DataTable } from "@/components/DataTable";
import { useDebounce } from "@/hooks/useDebounce";
import { useTablePagination } from "@/hooks/useTablePagination";
import { t } from "@/lib/i18n";
import { formatMoney } from "./formatMoney";

/**
 * Khối tài chính → Hoàn thành theo dịch vụ.
 *
 * The service lines of the window with five figures above them, one of which
 * says which way the clinic is moving against the period before.
 */
export function ServiceCompletionReport() {
  const range = usePeriodRange("month");
  const pagination = useTablePagination(20);
  const [keyword, setKeyword] = useState("");

  const debounced = useDebounce(keyword, 300);

  const query = useServiceCompletion({
    periodCode: range.periodCode,
    anchorIso: range.anchorIso,
    skipCount: pagination.skipCount,
    maxResultCount: pagination.maxResultCount,
    filter: debounced.trim() || undefined,
  });

  const stats = query.data?.stats;

  const cards = useMemo<StatCard[]>(() => {
    const change = stats?.revenueChangePercent;

    return [
      {
        key: "collected",
        value: formatMoney(stats?.actualCollected ?? 0),
        label: t("Thực thu"),
        icon: <WalletOutlined />,
        tone: "teal",
      },
      {
        key: "revenue",
        value: formatMoney(stats?.totalRevenue ?? 0),
        label: t("Tổng doanh thu"),
        icon: <RiseOutlined />,
        tone: "blue",
        badge:
          change === null || change === undefined
            ? undefined
            : {
                text: t("{0}% so với kỳ trước", `${change > 0 ? "+" : ""}${change}`),
                tone: change < 0 ? "rose" : "green",
              },
      },
      {
        key: "advance",
        value: formatMoney(stats?.advanceRevenue ?? 0),
        label: t("Doanh thu từ KH tạm ứng"),
        icon: <DollarOutlined />,
        tone: "amber",
      },
      {
        key: "completed",
        value: formatMoney(stats?.completedServices ?? 0),
        label: t("Dịch vụ hoàn thành"),
        icon: <CheckCircleOutlined />,
        tone: "green",
        badge: {
          text: t("{0}% đúng tiến độ", stats?.onScheduePercent ?? 0),
          tone: "green",
        },
      },
      {
        key: "ownQuota",
        value: formatMoney(stats?.ownQuotaServices ?? 0),
        label: t("Dịch vụ doanh số riêng"),
        icon: <StarOutlined />,
        tone: "rose",
        badge: { text: t("Tính theo định mức riêng"), tone: "rose" },
      },
    ];
  }, [stats]);

  const columns = useMemo(() => serviceCompletionColumns(), []);

  return (
    <div className="bd-ops-report-screen">
      <div className="bd-ops-report-bar">
        <OperationsPeriodBar range={range} />
      </div>

      <div className="bd-ops-report-filters">
        <Input
          className="bd-ops-search"
          prefix={<SearchOutlined />}
          placeholder={t("Tìm khách hàng, dịch vụ")}
          aria-label={t("Tìm khách hàng, dịch vụ")}
          value={keyword}
          allowClear
          onChange={(event) => {
            setKeyword(event.target.value);
            pagination.resetToFirstPage();
          }}
        />
      </div>

      <OperationsStatCards cards={cards} />

      <div className="bd-cat-card">
        <DataTable<ServiceLineRow>
          columns={columns}
          dataSource={query.data?.items ?? []}
          rowKey="id"
          loading={query.isFetching}
          scroll={{ x: 2800 }}
          pagination={pagination.buildConfig(
            query.data?.totalCount ?? 0,
            (total, rangeOf) =>
              total === 0
                ? t("Hiển thị 0 trên 0 dịch vụ")
                : t("Hiển thị {0}–{1} trên {2} dịch vụ", rangeOf[0], rangeOf[1], total),
          )}
          locale={{ emptyText: t("Không có dữ liệu") }}
        />
      </div>
    </div>
  );
}
