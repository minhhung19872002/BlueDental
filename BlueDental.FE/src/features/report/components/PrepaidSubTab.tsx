import { useMemo } from "react";
import type { TableColumnsType } from "antd";
import { t } from "@/lib/i18n";
import { formatDate, formatMoneyUnit } from "@/utils/format";
import { usePrepaidLines, useSalesSummary, type RangeQuery, type PrepaidLineDto } from "../api/clinicReportApi";
import { useClientPaging } from "../hooks/useClientPaging";
import { ReportStatCards, type StatCardItem } from "./ReportStatCards";
import { ReportStatsBar } from "./ReportStatsBar";
import { ReportTableCard } from "./ReportTableCard";
import { groupSpans, spanCell } from "./tableSpans";

/**
 * Event labels seen on staging (2026-09-22). Local only emits "deposit": a
 * top-up is held outside any slip, so nothing consumes, moves or replaces it.
 */
const EVENT_LABELS: Record<string, () => string> = {
  deposit: () => t("Report:Prepaid:EventDeposit"),
  consume: () => t("Report:Prepaid:EventConsume"),
  transfer: () => t("Report:Prepaid:EventTransfer"),
  replace: () => t("Report:Prepaid:EventReplace"),
  refund: () => t("Report:SubTab:Refund"),
};

/** Staging colours by sign, not by event: "+1.000.000 đ" green, "-500.000 đ" red. */
function renderSignedAmount(value: number) {
  const negative = value < 0;
  return (
    <span className={`report-money report-money--${negative ? "red" : "green"}`}>
      {negative ? "-" : "+"}
      {formatMoneyUnit(Math.abs(value))}
    </span>
  );
}

/** Like the reference: rows merge by day, then by customer within the day (including Số dư sau). */
function buildColumns(rows: PrepaidLineDto[]): TableColumnsType<PrepaidLineDto> {
  const dateSpans = groupSpans(rows, (r) => r.date);
  const patientSpans = groupSpans(rows, (r) => `${r.date}|${r.patientLabel}`);
  return [
    { title: t("Report:Column:Date"), dataIndex: "date", width: 110, render: (v: string) => formatDate(v), onCell: spanCell(dateSpans) },
    {
      title: t("Report:Column:CustomerName"),
      dataIndex: "patientLabel",
      width: 220,
      render: (v: string) => <span className="report-patient-link">{v}</span>,
      onCell: spanCell(patientSpans),
    },
    {
      title: t("Report:Prepaid:EventType"),
      dataIndex: "eventType",
      width: 180,
      render: (v: string) => EVENT_LABELS[v]?.() ?? v,
    },
    { title: t("Report:Column:TreatmentService"), dataIndex: "serviceName" },
    // Blue on every row: the deposit's voucher code, or "-" when the event has none.
    {
      title: t("Report:Prepaid:PaymentSlip"),
      dataIndex: "paymentCode",
      width: 210,
      render: (v: string) => <span className="report-voucher-code">{v || "-"}</span>,
    },
    { title: t("Report:Column:DoctorName"), dataIndex: "doctorName", width: 170 },
    { title: t("Report:Prepaid:Amount"), dataIndex: "amount", width: 140, align: "right", render: renderSignedAmount },
    {
      title: t("Report:Prepaid:BalanceAfter"),
      dataIndex: "balanceAfter",
      width: 140,
      align: "right",
      render: (v: number) => <span className="report-money report-money--blue">{formatMoneyUnit(v)}</span>,
      onCell: spanCell(patientSpans),
    },
  ];
}

/** Sub-tab "Tạm ứng": 4 tiles + green "Tạm ứng" pill (no export), then the prepaid ledger table. */
export function PrepaidSubTab(range: RangeQuery) {
  const { data: lines = [], isLoading } = usePrepaidLines(range);
  const { data: summary, isLoading: summaryLoading } = useSalesSummary(range);
  const paging = useClientPaging(lines);
  const columns = useMemo(() => buildColumns(paging.pageRows), [paging.pageRows]);

  const incurred = summary?.prepaidIncurred ?? 0;
  const consumed = summary?.prepaidConsumed ?? 0;
  const refund = summary?.prepaidRefund ?? 0;

  // Staging: blue / gold / red / violet tiles, the two outflows shown as negatives,
  // the pill as their net for the period, the last tile as what is held right now.
  const cards: StatCardItem[] = [
    { label: t("Report:Prepaid:Incurred"), value: incurred, tone: "blue" },
    { label: t("Report:Prepaid:Consumed"), value: -consumed, tone: "gold" },
    { label: t("Report:Prepaid:Refund"), value: -refund, tone: "red" },
    { label: t("Report:Prepaid:CurrentBalance"), value: summary?.prepaidBalance ?? 0, tone: "violet" },
  ];

  return (
    <>
      <div className="report-headline-row">
        <ReportStatCards variant="compact" items={cards} />
        <ReportStatsBar label={t("Report:SubTab:Prepaid")} value={incurred - consumed - refund} tone="green" loading={summaryLoading} />
      </div>
      <ReportTableCard<PrepaidLineDto>
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
