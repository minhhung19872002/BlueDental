import { useMemo, useState } from "react";
import type { ColumnsType } from "antd/es/table";
import { useConsultantSummary, type ConsultantSummaryRow } from "../api/operationReportApi";
import { operationsTotal } from "../operationsTotal";
import { OperationsPeriodBar } from "./OperationsPeriodBar";
import { StaffFilter } from "./StaffFilter";
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
  const [staffId, setStaffId] = useState<string | undefined>();

  const query = useConsultantSummary(
    {
      periodCode: range.periodCode,
      anchorIso: range.anchorIso,
      skipCount: pagination.skipCount,
      maxResultCount: pagination.maxResultCount,
    },
    { StaffId: staffId },
  );

  const columns = useMemo<ColumnsType<ConsultantSummaryRow>>(
    () => [
      { key: "staff", title: t("Operations:ConsultantStaff"), dataIndex: "staffName" },
      {
        key: "newCount",
        title: t("Operations:NewCustomerConsult"),
        width: 150,
        align: "right",
        render: (_, row) => <span className="bd-cat-num">{row.newPatientConsultations}</span>,
      },
      {
        key: "oldCount",
        title: t("Operations:ReturnCustomerConsult"),
        width: 150,
        align: "right",
        render: (_, row) => <span className="bd-cat-num">{row.returningPatientConsultations}</span>,
      },
      {
        key: "newRevenue",
        title: t("Operations:NewCustomerRevenue"),
        width: 190,
        align: "right",
        render: (_, row) => <span className="bd-cat-num">{formatMoney(row.newPatientRevenue)}</span>,
      },
      {
        key: "oldRevenue",
        title: t("Operations:ReturnCustomerRevenue"),
        width: 190,
        align: "right",
        render: (_, row) => (
          <span className="bd-cat-num">{formatMoney(row.returningPatientRevenue)}</span>
        ),
      },
      {
        key: "totalCount",
        title: t("Operations:TotalConsults"),
        width: 160,
        align: "right",
        render: (_, row) => <span className="bd-cat-num">{row.totalConsultations}</span>,
      },
      {
        key: "totalRevenue",
        title: t("Operations:ConsultRevenue"),
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
      <div className="bd-ops-report-bar bd-ops-report-bar--titled">
        <h2 className="bd-ops-report-title">{t("Operations:CustomerReportTitle")}</h2>

        <div className="bd-ops-report-barend">
          <OperationsPeriodBar range={range} periods={["day", "week", "month"]} />
          <StaffFilter
            label={t("Operations:ConsultantStaff")}
            value={staffId}
            onChange={(value) => {
              setStaffId(value);
              pagination.resetToFirstPage();
            }}
          />
        </div>
      </div>

      <div className="bd-cat-card">
        <DataTable<ConsultantSummaryRow>
          columns={columns}
          dataSource={query.data?.items ?? []}
          rowKey="staffId"
          loading={query.isFetching}
          pagination={pagination.buildConfig(query.data?.totalCount ?? 0, operationsTotal)}
          locale={{ emptyText: t("Common:NoData") }}
        />
      </div>
    </div>
  );
}
