import { useMemo } from "react";
import type { TableColumnsType } from "antd";
import { t } from "@/lib/i18n";
import { formatDate, formatMoneyUnit } from "@/utils/format";
import { useClientPaging } from "../hooks/useClientPaging";
import { useServiceLines, type RangeQuery, type ServiceLineDto } from "../api/clinicReportApi";
import { ReportStatsBar } from "./ReportStatsBar";
import { ReportTableCard } from "./ReportTableCard";
import { groupSpans, spanCell } from "./tableSpans";

/**
 * "Doanh số thực" counts the services still standing: a cancelled line is
 * dropped rather than shown struck through. ASSUMPTION — the reference branch
 * had no rows under this pill during the survey (docs/clone/pages/report.md).
 */
function liveLines(lines: ServiceLineDto[]): ServiceLineDto[] {
  return lines.filter((line) => !line.cancelled);
}

function buildColumns(rows: ServiceLineDto[]): TableColumnsType<ServiceLineDto> {
  const dateSpans = groupSpans(rows, (r) => r.date);
  const patientSpans = groupSpans(rows, (r) => `${r.date}|${r.patientLabel}`);
  return [
    {
      title: t("Report:Column:Date"),
      dataIndex: "date",
      width: 110,
      render: (v: string) => formatDate(v),
      onCell: spanCell(dateSpans),
    },
    {
      title: t("Report:Column:CustomerName"),
      dataIndex: "patientLabel",
      width: 220,
      render: (v: string) => <span className="report-patient-link">{v}</span>,
      onCell: spanCell(patientSpans),
    },
    { title: t("Report:Column:TreatmentPlan"), dataIndex: "ticketCode", width: 150 },
    { title: t("Report:Column:CounselorName"), dataIndex: "counselorName", width: 180 },
    { title: t("Report:Column:DoctorName"), dataIndex: "doctorName", width: 170 },
    { title: t("Report:Column:TreatmentService"), dataIndex: "serviceName" },
    { title: t("Report:Column:Quantity"), dataIndex: "quantity", width: 90, align: "center" },
    {
      title: t("Report:Column:TotalAmount"),
      dataIndex: "totalAmount",
      width: 140,
      align: "right",
      render: (v: number) => <span className="report-money">{formatMoneyUnit(v)}</span>,
    },
  ];
}

/** The orange "Doanh số thực" pill — the reference offers no export on this sub tab. */
export function ActualRevenueSubTabActions(range: RangeQuery) {
  const { data: lines = [], isLoading } = useServiceLines(range);
  const total = useMemo(() => liveLines(lines).reduce((sum, line) => sum + line.totalAmount, 0), [lines]);
  return <ReportStatsBar label={t("Report:SubTab:ActualRevenue")} value={total} tone="gold" loading={isLoading} />;
}

/** Sub-tab "Doanh số thực": the surviving service lines with their plan code. */
export function ActualRevenueSubTab(range: RangeQuery) {
  const { data: lines = [], isLoading } = useServiceLines(range);
  const rows = useMemo(() => liveLines(lines), [lines]);
  const paging = useClientPaging(rows);
  const columns = useMemo(() => buildColumns(paging.pageRows), [paging.pageRows]);

  return (
    <ReportTableCard<ServiceLineDto>
      rowKey="id"
      columns={columns}
      dataSource={paging.pageRows}
      loading={isLoading}
      totalCount={paging.totalCount}
      page={paging.page}
      pageSize={paging.pageSize}
      onPageChange={paging.onPageChange}
    />
  );
}
