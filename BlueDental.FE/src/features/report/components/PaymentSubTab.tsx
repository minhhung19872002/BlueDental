import { useCallback, useMemo } from "react";
import type { TableColumnsType } from "antd";
import { t } from "@/lib/i18n";
import { formatDate, formatMoneyUnit } from "@/utils/format";
import { excelColumnWidths, exportToExcel, type ExportColumn } from "@/utils/exportExcel";
import { paymentChannelLabels, type PaymentChannel } from "../api/financeApi";
import { usePaymentLines, useSalesSummary, buildDailyTotals, type RangeQuery, type PaymentLineDto } from "../api/clinicReportApi";
import { useClientPaging } from "../hooks/useClientPaging";
import { ReportStatCards, type StatCardItem } from "./ReportStatCards";
import { ReportStatsBar } from "./ReportStatsBar";
import { ReportTableCard } from "./ReportTableCard";
import { DailyTotalsTable } from "./DailyTotalsTable";

const money = (cls = "") => (v: number) => (
  <span className={`report-money ${cls}`.trim()}>{formatMoneyUnit(v)}</span>
);

/** One line per service, the cancelled ones chipped red "(đã huỷ)" like the reference. */
function ServiceList({ row }: { row: PaymentLineDto }) {
  const names = row.serviceNames ? row.serviceNames.split(", ") : [];
  if (names.length === 0) return <>—</>;
  const cancelled = new Set(row.cancelledServiceNames);
  return (
    <div className="report-service-list">
      {names.map((name, i) => (
        <span key={`${name}-${i}`}>
          {name}
          {cancelled.has(name) && <span className="report-status-chip report-status-chip--danger">{t("Report:ServiceStatus:Cancelled")}</span>}
        </span>
      ))}
    </div>
  );
}

function buildColumns(): TableColumnsType<PaymentLineDto> {
  const channels = paymentChannelLabels();
  return [
    { title: t("Report:Column:CreatedDate"), dataIndex: "date", width: 110, render: (v: string) => formatDate(v) },
    {
      title: t("Report:Column:CustomerName"),
      dataIndex: "patientLabel",
      width: 220,
      render: (v: string) => <span className="report-patient-link">{v}</span>,
    },
    { title: t("Report:PaymentSummary:PaymentCode"), dataIndex: "paymentCode", width: 190 },
    { title: t("Report:Column:TreatmentService"), key: "serviceNames", render: (_: unknown, row) => <ServiceList row={row} /> },
    { title: t("Report:PaymentSummary:InvoiceAmount"), dataIndex: "invoiceAmount", width: 130, align: "right", render: money() },
    { title: t("Report:PaymentSummary:Paid"), dataIndex: "paidAmount", width: 130, align: "right", render: money("report-money--bold") },
    { title: t("Report:PaymentSummary:ActualReceived"), dataIndex: "actualReceived", width: 130, align: "right", render: money("report-money--green") },
    { title: t("Report:PaymentSummary:RemainingPrepaid"), dataIndex: "remainingPrepaid", width: 150, align: "right", render: money("report-money--green") },
    { title: t("Report:Column:PaymentMethod"), dataIndex: "channel", width: 160, render: (v: PaymentLineDto["channel"]) => channels[v] },
    { title: t("Report:PaymentSummary:PaymentInfo"), dataIndex: "paymentInfo", width: 180, render: (v: string) => v || "—" },
    { title: t("Common:Note"), dataIndex: "note", width: 180, render: (v: string) => v || "—" },
  ];
}

/** The reference downloads `thanh-toan.xlsx` whatever the period. */
const PAYMENT_EXPORT_FILENAME = "thanh-toan";
/** `<cols>` of the reference download (server-generated), in Excel width units. */
const PAYMENT_EXPORT_WIDTHS = [16, 26, 18, 16, 22, 20, 20, 28, 18, 18, 22, 18, 22, 24, 28];

/**
 * The reference workbook is wider than the table: it splits the patient into
 * code + name, adds creator / treatment ticket / branch / bank info / note, and
 * writes amounts as plain numbers so Excel can sum them. Column order matches
 * the reference file exactly (docs/clone/pages/report.md).
 */
function buildExportColumns(): ExportColumn<PaymentLineDto>[] {
  return [
    { header: t("Report:Column:CreatedDate"), key: "date", format: (v) => formatDate(String(v)) },
    { header: t("Report:PaymentSummary:PaymentCode"), key: "paymentCode" },
    { header: t("Report:Column:Creator"), key: "createdBy" },
    { header: t("Report:Column:CustomerCode"), key: "patientCode" },
    { header: t("Report:Column:CustomerName"), key: "patientName" },
    { header: t("Report:PaymentSummary:TreatmentTicketCode"), key: "treatmentCode" },
    { header: t("Report:Column:Branch"), key: "branchName" },
    { header: t("Report:Column:TreatmentService"), key: "serviceNames" },
    { header: t("Report:PaymentSummary:InvoiceAmount"), key: "invoiceAmount" },
    { header: t("Report:PaymentSummary:Paid"), key: "paidAmount" },
    { header: t("Report:PaymentSummary:RemainingPrepaid"), key: "remainingPrepaid" },
    { header: t("Report:Overview:ActualReceived"), key: "actualReceived" },
    { header: t("Report:Column:PaymentMethod"), key: "channel", format: (v) => paymentChannelLabels()[Number(v) as PaymentChannel] ?? "" },
    { header: t("Report:PaymentSummary:PaymentInfo"), key: "paymentInfo" },
    { header: t("Common:Note"), key: "note" },
  ];
}

/** Sub-tab "Thanh toán": 5 tiles + Thực thu pill on one row, then main table + daily side table. */
export function PaymentSubTab(range: RangeQuery) {
  const { data: lines = [], isLoading } = usePaymentLines(range);
  const { data: summary, isLoading: summaryLoading } = useSalesSummary(range);
  const daily = useMemo(
    () => buildDailyTotals(range.fromDate, range.toDate, lines.map((l) => ({ date: l.date, amount: l.actualReceived }))),
    [lines, range.fromDate, range.toDate],
  );
  const paging = useClientPaging(lines);
  const columns = useMemo(buildColumns, []);

  const cards: StatCardItem[] = [
    { label: t("Report:PaymentChannel:Cash"), value: summary?.byCash ?? 0, tone: "green" },
    { label: t("Report:PaymentChannel:Banking"), value: summary?.byBanking ?? 0, tone: "blue" },
    { label: t("Report:PaymentChannel:Card"), value: summary?.byCard ?? 0, tone: "gold" },
    { label: t("Report:PaymentSummary:Debt"), value: summary?.byDebt ?? 0, tone: "green" },
    { label: t("Report:SubTab:Refund"), value: summary?.refund ?? 0, tone: "gold" },
    { label: t("Report:SubTab:Prepaid"), value: summary?.prepaidIncurred ?? 0, tone: "blue" },
  ];

  const handleExport = useCallback(() => {
    exportToExcel<PaymentLineDto>(lines, buildExportColumns(), PAYMENT_EXPORT_FILENAME, {
      sheetName: t("Report:SubTab:Payment"),
      columnWidths: excelColumnWidths(PAYMENT_EXPORT_WIDTHS),
    });
  }, [lines]);

  return (
    <>
      <div className="report-headline-row">
        <ReportStatCards variant="compact" items={cards} />
        <ReportStatsBar
          label={t("Report:SubTab:ActualRevenue")}
          value={summary?.actualReceived ?? 0}
          tone="green"
          loading={summaryLoading}
          onExport={handleExport}
        />
      </div>
      <div className="report-payment-layout">
        <ReportTableCard<PaymentLineDto>
          className="report-payment-main"
          rowKey="id"
          columns={columns}
          dataSource={paging.pageRows}
          loading={isLoading}
          totalCount={paging.totalCount}
          page={paging.page}
          pageSize={paging.pageSize}
          onPageChange={paging.onPageChange}
          countUnit={t("Report:Unit:Voucher")}
        />
        <DailyTotalsTable rows={daily} valueLabel={t("Report:SubTab:ActualRevenue")} />
      </div>
    </>
  );
}
