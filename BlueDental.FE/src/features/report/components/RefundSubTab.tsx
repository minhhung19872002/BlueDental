import { useCallback, useMemo } from "react";
import type { TableColumnsType } from "antd";
import { t } from "@/lib/i18n";
import { formatDate, formatMoneyUnit } from "@/utils/format";
import { excelColumnWidths, exportToExcel, type ExportColumn } from "@/utils/exportExcel";
import { useRefundLines, useSalesSummary, buildDailyTotals, type RangeQuery, type RefundLineDto } from "../api/clinicReportApi";
import { useClientPaging } from "../hooks/useClientPaging";
import { ReportStatCards, type StatCardItem } from "./ReportStatCards";
import { ReportStatsBar } from "./ReportStatsBar";
import { ReportTableCard } from "./ReportTableCard";
import { DailyTotalsTable } from "./DailyTotalsTable";

function buildColumns(): TableColumnsType<RefundLineDto> {
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
      render: (v: number) => <span className="report-money report-money--red">{formatMoneyUnit(v)}</span>,
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
function buildExportColumns(): ExportColumn<RefundLineDto>[] {
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

/** The reference downloads `hoan-tien.xlsx` whatever the period. */
const REFUND_EXPORT_FILENAME = "hoan-tien";
/** `<cols>` of the reference download (server-generated), in Excel width units. */
const REFUND_EXPORT_WIDTHS = [16, 22, 16, 24, 28, 18, 36];

/** Sub-tab "Hoàn tiền": 3 tiles + Hoàn tiền pill on one row, then table + daily side table. */
export function RefundSubTab(range: RangeQuery) {
  const { data: lines = [], isLoading } = useRefundLines(range);
  const { data: summary, isLoading: summaryLoading } = useSalesSummary(range);
  const daily = useMemo(
    () => buildDailyTotals(range.fromDate, range.toDate, lines.map((l) => ({ date: l.date, amount: l.refundAmount }))),
    [lines, range.fromDate, range.toDate],
  );
  const paging = useClientPaging(lines);
  const columns = useMemo(buildColumns, []);

  const cards: StatCardItem[] = [
    { label: t("Tiền Mặt"), value: summary?.refundByCash ?? 0, tone: "green" },
    { label: t("Chuyển Khoản"), value: summary?.refundByBanking ?? 0, tone: "blue" },
    { label: t("Cà Thẻ"), value: summary?.refundByCard ?? 0, tone: "gold" },
  ];

  const handleExport = useCallback(() => {
    exportToExcel<RefundLineDto>(lines, buildExportColumns(), REFUND_EXPORT_FILENAME, {
      sheetName: t("Hoàn tiền"),
      columnWidths: excelColumnWidths(REFUND_EXPORT_WIDTHS),
    });
  }, [lines]);

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
        <ReportTableCard<RefundLineDto>
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
        <DailyTotalsTable rows={daily} valueLabel={t("Hoàn tiền")} />
      </div>
    </>
  );
}
