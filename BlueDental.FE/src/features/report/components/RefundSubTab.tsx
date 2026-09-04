import { useCallback, useMemo } from "react";
import type { TableColumnsType } from "antd";
import { t } from "@/lib/i18n";
import { formatDate, formatVND } from "@/utils/format";
import { exportToExcel, type ExportColumn } from "@/utils/exportExcel";
import { useMockRefundLines, useMockSalesSummary, type RangeQuery } from "../api/reportMockQueries";
import { useClientPaging } from "../hooks/useClientPaging";
import type { RefundLineVm } from "../types/mock";
import { ReportStatCards, type StatCardItem } from "./ReportStatCards";
import { ReportStatsBar } from "./ReportStatsBar";
import { ReportTableCard } from "./ReportTableCard";
import { DailyTotalsTable } from "./DailyTotalsTable";

function buildColumns(): TableColumnsType<RefundLineVm> {
  return [
    { title: t("Ngày tạo"), dataIndex: "date", width: 110, render: (v: string) => formatDate(v) },
    {
      title: t("Tên khách hàng"),
      dataIndex: "patientLabel",
      width: 220,
      render: (v: string) => <span className="report-patient-link">{v}</span>,
    },
    { title: t("Mã thanh toán"), dataIndex: "refundCode", width: 190 },
    { title: t("Dịch vụ điều trị"), dataIndex: "serviceNames" },
    {
      title: t("Tổng hoàn"),
      dataIndex: "refundAmount",
      width: 130,
      align: "right",
      render: (v: number) => <span className="report-money report-money--red">{formatVND(v)} đ</span>,
    },
    { title: t("Ghi chú"), dataIndex: "note", width: 200 },
  ];
}

/**
 * The reference workbook differs from the table: the code column comes right
 * after the date and is headed "Mã hoàn tiền", the patient is split into code +
 * name, and the amount is a plain number. Order matches the reference file
 * exactly (docs/clone/pages/report.md).
 */
function buildExportColumns(): ExportColumn<RefundLineVm>[] {
  return [
    { header: t("Ngày tạo"), key: "date", format: (v) => formatDate(String(v)) },
    { header: t("Mã hoàn tiền"), key: "refundCode" },
    { header: t("Mã khách hàng"), key: "patientCode" },
    { header: t("Tên khách hàng"), key: "patientName" },
    { header: t("Dịch vụ điều trị"), key: "serviceNames" },
    { header: t("Tổng hoàn"), key: "refundAmount" },
    { header: t("Ghi chú"), key: "note" },
  ];
}

/** Sub-tab "Hoàn tiền": 3 tiles + Hoàn tiền pill on one row, then table + daily side table. */
export function RefundSubTab(range: RangeQuery) {
  const { data, isLoading } = useMockRefundLines(range);
  const { data: summary, isLoading: summaryLoading } = useMockSalesSummary(range);
  const lines = useMemo(() => data?.lines ?? [], [data]);
  const paging = useClientPaging(lines);
  const columns = useMemo(buildColumns, []);

  const cards: StatCardItem[] = [
    { label: t("Tiền Mặt"), value: summary?.refundByCash ?? 0, tone: "green" },
    { label: t("Chuyển Khoản"), value: summary?.refundByBanking ?? 0, tone: "blue" },
    { label: t("Cà Thẻ"), value: summary?.refundByCard ?? 0, tone: "gold" },
  ];

  const handleExport = useCallback(() => {
    exportToExcel<RefundLineVm>(lines, buildExportColumns(), `hoan-tien-${range.fromDate}-${range.toDate}`);
  }, [lines, range.fromDate, range.toDate]);

  return (
    <>
      <div className="report-headline-row">
        <ReportStatCards variant="compact" items={cards} />
        <ReportStatsBar
          label={t("Hoàn tiền")}
          value={summary?.refund ?? 0}
          tone="gold"
          loading={summaryLoading}
          onExport={handleExport}
        />
      </div>
      <div className="report-payment-layout">
        <ReportTableCard<RefundLineVm>
          className="report-payment-main"
          rowKey="id"
          columns={columns}
          dataSource={paging.pageRows}
          loading={isLoading}
          totalCount={paging.totalCount}
          page={paging.page}
          pageSize={paging.pageSize}
          onPageChange={paging.onPageChange}
        />
        <DailyTotalsTable rows={data?.daily ?? []} valueLabel={t("Hoàn tiền")} />
      </div>
    </>
  );
}
