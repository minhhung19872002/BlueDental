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
  cancelled: { className: "report-status-chip--danger", label: () => t("(đã hủy)") },
  replaced: { className: "report-status-chip--info", label: () => t("(thay thế)") },
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
      title: t("Ngày"),
      dataIndex: "date",
      width: 130,
      render: (v: string) => formatDate(v),
      onCell: spanCell(dateSpans),
    },
    {
      title: t("Tên khách hàng"),
      dataIndex: "patientLabel",
      width: 190,
      render: (v: string) => <span className="report-patient-link">{v}</span>,
      onCell: spanCell(patientSpans),
    },
    { title: t("Nhân sự tư vấn"), dataIndex: "counselorName", width: 170 },
    { title: t("Bác sĩ tiếp nhận"), dataIndex: "doctorName", width: 180 },
    { title: t("Dịch vụ điều trị"), key: "serviceName", width: 190, render: (_: unknown, row) => <ServiceCell row={row} /> },
    { title: t("Số lượng"), dataIndex: "quantity", width: 120, align: "center" },
    { title: t("Dư nợ phát sinh"), dataIndex: "debtIncurred", width: 140, align: "right", render: money("report-money--red") },
    { title: t("Sử dụng dư nợ"), dataIndex: "debtUsed", width: 140, align: "right", render: money("report-money--green") },
    { title: t("Hoàn dư nợ"), dataIndex: "debtRefund", width: 130, align: "right", render: money("report-money--gold") },
  ];
}

/** Sub-tab "Dư nợ": 3 tiles + green "Dư nợ" pill (no export), then the grouped table. */
export function DebtSubTab(range: RangeQuery) {
  const { data: lines = [], isLoading } = useDebtLines(range);
  const { data: summary, isLoading: summaryLoading } = useSalesSummary(range);
  const paging = useClientPaging(lines);
  const columns = useMemo(() => buildColumns(paging.pageRows), [paging.pageRows]);

  const cards: StatCardItem[] = [
    { label: t("Dư nợ phát sinh"), value: summary?.debtIncurred ?? 0, tone: "blue" },
    { label: t("Sử dụng dư nợ"), value: summary?.debtUsed ?? 0, tone: "green" },
    { label: t("Hoàn dư nợ"), value: summary?.debtRefund ?? 0, tone: "red" },
  ];

  const outstanding = (summary?.debtIncurred ?? 0) - (summary?.debtUsed ?? 0) - (summary?.debtRefund ?? 0);

  return (
    <>
      <div className="report-headline-row">
        <ReportStatCards variant="compact" items={cards} />
        <ReportStatsBar label={t("Dư nợ")} value={Math.max(outstanding, 0)} tone="green" loading={summaryLoading} />
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
        countUnit={t("dòng")}
      />
    </>
  );
}
