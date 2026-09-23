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
    { title: t("Report:Column:CreatedDate"), dataIndex: "date", width: 110, render: (v: string) => formatDate(v) },
    {
      title: t("Report:Column:CustomerName"),
      dataIndex: "patientLabel",
      width: 220,
      render: (v: string) => <span className="report-patient-link">{v}</span>,
    },
    { title: t("Report:PaymentSummary:PaymentCode"), dataIndex: "refundCode", width: 190 },
    { title: t("Report:Column:TreatmentService"), dataIndex: "serviceNames" },
    {
      title: t("Report:SalesDetail:TotalRefund"),
      dataIndex: "refundAmount",
      width: 130,
      align: "right",
      render: (v: number) => <span className="report-money report-money--red">{formatMoneyUnit(v)}</span>,
    },
    { title: t("Common:Note"), dataIndex: "note", width: 200 },
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
    { header: t("Report:Column:CreatedDate"), key: "date", format: (v) => formatDate(String(v)) },
    { header: t("Report:SalesDetail:RefundCode"), key: "refundCode" },
    { header: t("Report:Column:CustomerCode"), key: "patientCode" },
    { header: t("Report:Column:CustomerName"), key: "patientName" },
    { header: t("Report:Column:TreatmentService"), key: "serviceNames" },
    { header: t("Report:SalesDetail:TotalRefund"), key: "refundAmount" },
    { header: t("Common:Note"), key: "note" },
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
    { label: t("Report:PaymentChannel:Cash"), value: summary?.refundByCash ?? 0, tone: "green" },
    { label: t("Report:PaymentChannel:Banking"), value: summary?.refundByBanking ?? 0, tone: "blue" },
    { label: t("Report:PaymentChannel:Card"), value: summary?.refundByCard ?? 0, tone: "gold" },
  ];

  const handleExport = useCallback(() => {
    exportToExcel<RefundLineDto>(lines, buildExportColumns(), REFUND_EXPORT_FILENAME, {
      sheetName: t("Report:SubTab:Refund"),
      columnWidths: excelColumnWidths(REFUND_EXPORT_WIDTHS),
    });
  }, [lines]);

  return (
    <>
      <div className="report-headline-row">
        <ReportStatCards variant="compact" items={cards} />
        <ReportStatsBar
          label={t("Report:SubTab:Refund")}
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
        <DailyTotalsTable rows={daily} valueLabel={t("Report:SubTab:Refund")} />
      </div>
    </>
  );
}
