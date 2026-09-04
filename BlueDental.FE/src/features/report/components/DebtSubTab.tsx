import { useMemo } from "react";
import type { TableColumnsType } from "antd";
import { t } from "@/lib/i18n";
import { formatDate, formatVND } from "@/utils/format";
import { useMockDebtLines, useMockSalesSummary, type RangeQuery } from "../api/reportMockQueries";
import { useClientPaging } from "../hooks/useClientPaging";
import type { DebtLineVm } from "../types/mock";
import { ReportStatCards, type StatCardItem } from "./ReportStatCards";
import { ReportStatsBar } from "./ReportStatsBar";
import { ReportTableCard } from "./ReportTableCard";
import { groupSpans, spanCell } from "./tableSpans";

const money = (cls = "") => (v: number) => (
  <span className={`report-money ${cls}`.trim()}>{formatVND(v)} đ</span>
);

function buildColumns(rows: DebtLineVm[]): TableColumnsType<DebtLineVm> {
  const dateSpans = groupSpans(rows, (r) => r.date);
  const patientSpans = groupSpans(rows, (r) => `${r.date}|${r.patientLabel}`);
  return [
    {
      title: t("Ngày"),
      dataIndex: "date",
      width: 110,
      render: (v: string) => formatDate(v),
      onCell: spanCell(dateSpans),
    },
    {
      title: t("Tên khách hàng"),
      dataIndex: "patientLabel",
      width: 220,
      render: (v: string) => <span className="report-patient-link">{v}</span>,
      onCell: spanCell(patientSpans),
    },
    { title: t("Nhân sự tư vấn"), dataIndex: "counselorName", width: 170 },
    { title: t("Bác sĩ tiếp nhận"), dataIndex: "doctorName", width: 170 },
    { title: t("Dịch vụ điều trị"), dataIndex: "serviceName" },
    { title: t("Số lượng"), dataIndex: "quantity", width: 90, align: "center" },
    { title: t("Dư nợ phát sinh"), dataIndex: "debtIncurred", width: 140, align: "right", render: money("report-money--red") },
    { title: t("Sử dụng dư nợ"), dataIndex: "debtUsed", width: 140, align: "right", render: money("report-money--green") },
    { title: t("Hoàn dư nợ"), dataIndex: "debtRefund", width: 130, align: "right", render: money("report-money--gold") },
  ];
}

/** Sub-tab "Dư nợ": 3 tiles + green "Dư nợ" pill (no export), then the grouped table. */
export function DebtSubTab(range: RangeQuery) {
  const { data: lines = [], isLoading } = useMockDebtLines(range);
  const { data: summary, isLoading: summaryLoading } = useMockSalesSummary(range);
  const paging = useClientPaging(lines);
  const columns = useMemo(() => buildColumns(paging.pageRows), [paging.pageRows]);

  const cards: StatCardItem[] = [
    { label: t("Dư nợ phát sinh"), value: summary?.debtIncurred ?? 0, tone: "red" },
    { label: t("Sử dụng dư nợ"), value: summary?.debtUsed ?? 0, tone: "green" },
    { label: t("Hoàn dư nợ"), value: summary?.debtRefund ?? 0, tone: "gold" },
  ];

  const outstanding = (summary?.debtIncurred ?? 0) - (summary?.debtUsed ?? 0) - (summary?.debtRefund ?? 0);

  return (
    <>
      <div className="report-headline-row">
        <ReportStatCards variant="compact" items={cards} />
        <ReportStatsBar label={t("Dư nợ")} value={Math.max(outstanding, 0)} tone="green" loading={summaryLoading} />
      </div>
      <ReportTableCard<DebtLineVm>
        rowKey="id"
        columns={columns}
        dataSource={paging.pageRows}
        loading={isLoading}
        totalCount={paging.totalCount}
        page={paging.page}
        pageSize={paging.pageSize}
        onPageChange={paging.onPageChange}
      />
    </>
  );
}
