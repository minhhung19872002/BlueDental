import { useMemo } from "react";
import type { TableColumnsType } from "antd";
import { t } from "@/lib/i18n";
import { formatDate, formatMoneyUnit } from "@/utils/format";
import { useDebtLines, useSalesSummary, type RangeQuery, type DebtLineDto } from "../api/clinicReportApi";
import { useClientPaging } from "../hooks/useClientPaging";
import { ReportStatCards, type StatCardItem } from "./ReportStatCards";
import { ReportStatsBar } from "./ReportStatsBar";
import { ReportTableCard } from "./ReportTableCard";
import { groupSpans, spanCell } from "./tableSpans";

const money = (cls = "") => (v: number) => (
  <span className={`report-money ${cls}`.trim()}>{formatMoneyUnit(v)}</span>
);

/** The reference's chips after a service name: red "(đã hủy)", blue "(thay thế)". */
const STATUS_CHIP: Record<string, { className: string; label: () => string }> = {
  cancelled: { className: "report-status-chip--danger", label: () => t("Report:Status:Cancelled") },
  replaced: { className: "report-status-chip--info", label: () => t("Report:Status:Replaced") },
};

function ServiceCell({ row }: { row: DebtLineDto }) {
  const chip = STATUS_CHIP[row.status];
  return (
    <>
      {row.serviceName}
      {chip && <span className={`report-status-chip ${chip.className}`}>{chip.label()}</span>}
    </>
  );
}

function buildColumns(rows: DebtLineDto[]): TableColumnsType<DebtLineDto> {
  const dateSpans = groupSpans(rows, (r) => r.date);
  const patientSpans = groupSpans(rows, (r) => `${r.date}|${r.patientLabel}`);
  return [
    {
      title: t("Report:Column:Date"),
      dataIndex: "date",
      width: 130,
      render: (v: string) => formatDate(v),
      onCell: spanCell(dateSpans),
    },
    {
      title: t("Report:Column:CustomerName"),
      dataIndex: "patientLabel",
      width: 190,
      render: (v: string) => <span className="report-patient-link">{v}</span>,
      onCell: spanCell(patientSpans),
    },
    { title: t("Report:Column:CounselorName"), dataIndex: "counselorName", width: 170 },
    { title: t("Report:Column:DoctorName"), dataIndex: "doctorName", width: 180 },
    { title: t("Report:Column:TreatmentService"), key: "serviceName", width: 190, render: (_: unknown, row) => <ServiceCell row={row} /> },
    { title: t("Report:Column:Quantity"), dataIndex: "quantity", width: 120, align: "center" },
    { title: t("Report:Column:DebtIncurred"), dataIndex: "debtIncurred", width: 140, align: "right", render: money("report-money--red") },
    { title: t("Report:Column:DebtUsed"), dataIndex: "debtUsed", width: 140, align: "right", render: money("report-money--green") },
    { title: t("Report:Column:DebtRefund"), dataIndex: "debtRefund", width: 130, align: "right", render: money("report-money--gold") },
  ];
}

/** Sub-tab "Dư nợ": 3 tiles + green "Dư nợ" pill (no export), then the grouped table. */
export function DebtSubTab(range: RangeQuery) {
  const { data: lines = [], isLoading } = useDebtLines(range);
  const { data: summary, isLoading: summaryLoading } = useSalesSummary(range);
  const paging = useClientPaging(lines);
  const columns = useMemo(() => buildColumns(paging.pageRows), [paging.pageRows]);

  const cards: StatCardItem[] = [
    { label: t("Report:Column:DebtIncurred"), value: summary?.debtIncurred ?? 0, tone: "blue" },
    { label: t("Report:Column:DebtUsed"), value: summary?.debtUsed ?? 0, tone: "green" },
    { label: t("Report:Column:DebtRefund"), value: summary?.debtRefund ?? 0, tone: "red" },
  ];

  const outstanding = (summary?.debtIncurred ?? 0) - (summary?.debtUsed ?? 0) - (summary?.debtRefund ?? 0);

  return (
    <>
      <div className="report-headline-row">
        <ReportStatCards variant="compact" items={cards} />
        <ReportStatsBar label={t("Report:SubTab:Debt")} value={Math.max(outstanding, 0)} tone="green" loading={summaryLoading} />
      </div>
      <ReportTableCard<DebtLineDto>
        rowKey="id"
        columns={columns}
        dataSource={paging.pageRows}
        loading={isLoading}
        totalCount={paging.totalCount}
        page={paging.page}
        pageSize={paging.pageSize}
        onPageChange={paging.onPageChange}
        countUnit={t("Report:Unit:Row")}
      />
    </>
  );
}
