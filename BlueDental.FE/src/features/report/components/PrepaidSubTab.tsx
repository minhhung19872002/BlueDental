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
  deposit: () => t("Tạm ứng phát sinh"),
  consume: () => t("Tiêu tạm ứng theo tiến độ"),
  transfer: () => t("Chuyển tạm ứng sang dịch vụ mới"),
  replace: () => t("Xóa tạm ứng dịch vụ cũ (thay thế)"),
  refund: () => t("Hoàn tiền"),
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
    { title: t("Ngày"), dataIndex: "date", width: 110, render: (v: string) => formatDate(v), onCell: spanCell(dateSpans) },
    {
      title: t("Khách hàng"),
      dataIndex: "patientLabel",
      width: 220,
      render: (v: string) => <span className="report-patient-link">{v}</span>,
      onCell: spanCell(patientSpans),
    },
    {
      title: t("Loại sự kiện"),
      dataIndex: "eventType",
      width: 180,
      render: (v: string) => EVENT_LABELS[v]?.() ?? v,
    },
    { title: t("Dịch vụ"), dataIndex: "serviceName" },
    // Blue on every row: the deposit's voucher code, or "-" when the event has none.
    {
      title: t("Phiếu thanh toán"),
      dataIndex: "paymentCode",
      width: 210,
      render: (v: string) => <span className="report-voucher-code">{v || "-"}</span>,
    },
    { title: t("Bác sĩ điều trị"), dataIndex: "doctorName", width: 170 },
    { title: t("Số tiền"), dataIndex: "amount", width: 140, align: "right", render: renderSignedAmount },
    {
      title: t("Số dư sau"),
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
    { label: t("Tạm ứng phát sinh"), value: incurred, tone: "blue" },
    { label: t("Tiêu dùng tạm ứng"), value: -consumed, tone: "gold" },
    { label: t("Hoàn tiền tạm ứng"), value: -refund, tone: "red" },
    { label: t("Số dư tạm ứng hiện tại"), value: summary?.prepaidBalance ?? 0, tone: "violet" },
  ];

  return (
    <>
      <div className="report-headline-row">
        <ReportStatCards variant="compact" items={cards} />
        <ReportStatsBar label={t("Tạm ứng")} value={incurred - consumed - refund} tone="green" loading={summaryLoading} />
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
