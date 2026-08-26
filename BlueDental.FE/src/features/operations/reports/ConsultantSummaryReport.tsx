import { useMemo } from "react";
import type { ColumnsType } from "antd/es/table";
import { useConsultantSummary, type ConsultantSummaryRow } from "../api/operationReportApi";
import { operationsTotal } from "../operationsTotal";
import { OperationsPeriodBar } from "./OperationsPeriodBar";
import { usePeriodRange } from "./usePeriodRange";
import { DataTable } from "@/components/DataTable";
import { useTablePagination } from "@/hooks/useTablePagination";
import { t } from "@/lib/i18n";
import { formatMoney } from "./formatMoney";

/**
 * Khối tài chính → Khách hàng phát sinh.
 *
 * One row per consultant: how many people they advised in the window, split by
 * whether the clinic had seen that patient before, and what each half was
 * worth. The reference offers no Năm here, so neither does this.
 */
export function ConsultantSummaryReport() {
  const range = usePeriodRange("month");
  const pagination = useTablePagination(20);

  const query = useConsultantSummary({
    periodCode: range.periodCode,
    anchorIso: range.anchorIso,
    skipCount: pagination.skipCount,
    maxResultCount: pagination.maxResultCount,
  });

  const columns = useMemo<ColumnsType<ConsultantSummaryRow>>(
    () => [
      { key: "staff", title: t("Nhân sự tư vấn"), dataIndex: "staffName" },
      {
        key: "newCount",
        title: t("Tư vấn khách mới"),
        width: 150,
        align: "right",
        render: (_, row) => <span className="bd-cat-num">{row.newPatientConsultations}</span>,
      },
      {
        key: "oldCount",
        title: t("Tư vấn khách cũ"),
        width: 150,
        align: "right",
        render: (_, row) => <span className="bd-cat-num">{row.returningPatientConsultations}</span>,
      },
      {
        key: "newRevenue",
        title: t("Doanh thu khách mới"),
        width: 190,
        align: "right",
        render: (_, row) => <span className="bd-cat-num">{formatMoney(row.newPatientRevenue)}</span>,
      },
      {
        key: "oldRevenue",
        title: t("Doanh thu khách cũ"),
        width: 190,
        align: "right",
        render: (_, row) => (
          <span className="bd-cat-num">{formatMoney(row.returningPatientRevenue)}</span>
        ),
      },
      {
        key: "totalCount",
        title: t("Tổng lượt tư vấn"),
        width: 160,
        align: "right",
        render: (_, row) => <span className="bd-cat-num">{row.totalConsultations}</span>,
      },
      {
        key: "totalRevenue",
        title: t("Doanh thu từ tư vấn"),
        width: 190,
        align: "right",
        render: (_, row) => (
          <span className="bd-cat-num bd-semibold">{formatMoney(row.totalRevenue)}</span>
        ),
      },
    ],
    [],
  );

  return (
    <div className="bd-ops-report-screen">
      <div className="bd-ops-report-bar">
        <OperationsPeriodBar range={range} periods={["day", "week", "month"]} />
      </div>

      <div className="bd-cat-card">
        <DataTable<ConsultantSummaryRow>
          columns={columns}
          dataSource={query.data?.items ?? []}
          rowKey="staffId"
          loading={query.isFetching}
          pagination={pagination.buildConfig(query.data?.totalCount ?? 0, operationsTotal)}
          locale={{ emptyText: t("Không có dữ liệu") }}
        />
      </div>
    </div>
  );
}
