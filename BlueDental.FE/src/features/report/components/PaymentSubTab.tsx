import { useCallback, useMemo } from "react";
import type { TableColumnsType } from "antd";
import { t } from "@/lib/i18n";
import { formatDate, formatVND } from "@/utils/format";
import { exportToExcel, type ExportColumn } from "@/utils/exportExcel";
import { paymentChannelLabels, type PaymentChannel } from "../api/financeApi";
import { useMockPaymentLines, useMockSalesSummary, type RangeQuery } from "../api/reportMockQueries";
import { useClientPaging } from "../hooks/useClientPaging";
import type { PaymentLineVm } from "../types/mock";
import { ReportStatCards, type StatCardItem } from "./ReportStatCards";
import { ReportStatsBar } from "./ReportStatsBar";
import { ReportTableCard } from "./ReportTableCard";
import { DailyTotalsTable } from "./DailyTotalsTable";

const money = (cls = "") => (v: number) => (
  <span className={`report-money ${cls}`.trim()}>{formatVND(v)} đ</span>
);

function buildColumns(): TableColumnsType<PaymentLineVm> {
  const channels = paymentChannelLabels();
  return [
    { title: t("Ngày tạo"), dataIndex: "date", width: 110, render: (v: string) => formatDate(v) },
    {
      title: t("Tên khách hàng"),
      dataIndex: "patientLabel",
      width: 220,
      render: (v: string) => <span className="report-patient-link">{v}</span>,
    },
    { title: t("Mã thanh toán"), dataIndex: "paymentCode", width: 190 },
    { title: t("Dịch vụ điều trị"), dataIndex: "serviceNames" },
    { title: t("Tổng tiền phiếu"), dataIndex: "invoiceAmount", width: 130, align: "right", render: money() },
    { title: t("Thanh toán"), dataIndex: "paidAmount", width: 130, align: "right", render: money("report-money--bold") },
    { title: t("Tổng thực thu"), dataIndex: "actualReceived", width: 130, align: "right", render: money("report-money--green") },
    { title: t("Tổng tạm ứng còn lại"), dataIndex: "remainingPrepaid", width: 150, align: "right", render: money("report-money--green") },
    { title: t("Phương thức thanh toán"), dataIndex: "channel", width: 160, render: (v: PaymentLineVm["channel"]) => channels[v] },
  ];
}

/**
 * The reference workbook is wider than the table: it splits the patient into
 * code + name, adds creator / treatment ticket / branch / bank info / note, and
 * writes amounts as plain numbers so Excel can sum them. Column order matches
 * the reference file exactly (docs/clone/pages/report.md).
 */
function buildExportColumns(): ExportColumn<PaymentLineVm>[] {
  return [
    { header: t("Ngày tạo"), key: "date", format: (v) => formatDate(String(v)) },
    { header: t("Mã thanh toán"), key: "paymentCode" },
    { header: t("Người tạo"), key: "createdBy" },
    { header: t("Mã khách hàng"), key: "patientCode" },
    { header: t("Tên khách hàng"), key: "patientName" },
    { header: t("Mã phiếu điều trị"), key: "treatmentCode" },
    { header: t("Chi nhánh"), key: "branchName" },
    { header: t("Dịch vụ điều trị"), key: "serviceNames" },
    { header: t("Tổng tiền phiếu"), key: "invoiceAmount" },
    { header: t("Thanh toán"), key: "paidAmount" },
    { header: t("Tổng tạm ứng còn lại"), key: "remainingPrepaid" },
    { header: t("Thực thu"), key: "actualReceived" },
    { header: t("Phương thức thanh toán"), key: "channel", format: (v) => paymentChannelLabels()[Number(v) as PaymentChannel] ?? "" },
    { header: t("Thông tin thanh toán"), key: "paymentInfo" },
    { header: t("Ghi chú"), key: "note" },
  ];
}

/** Sub-tab "Thanh toán": 5 tiles + Thực thu pill on one row, then main table + daily side table. */
export function PaymentSubTab(range: RangeQuery) {
  const { data, isLoading } = useMockPaymentLines(range);
  const { data: summary, isLoading: summaryLoading } = useMockSalesSummary(range);
  const lines = useMemo(() => data?.lines ?? [], [data]);
  const paging = useClientPaging(lines);
  const columns = useMemo(buildColumns, []);

  const cards: StatCardItem[] = [
    { label: t("Tiền Mặt"), value: summary?.byCash ?? 0, tone: "green" },
    { label: t("Chuyển Khoản"), value: summary?.byBanking ?? 0, tone: "blue" },
    { label: t("Cà Thẻ"), value: summary?.byCard ?? 0, tone: "gold" },
    { label: t("Dư nợ"), value: summary?.byDebt ?? 0, tone: "green" },
    { label: t("Hoàn tiền"), value: summary?.refund ?? 0, tone: "gold" },
  ];

  const handleExport = useCallback(() => {
    exportToExcel<PaymentLineVm>(lines, buildExportColumns(), `thanh-toan-${range.fromDate}-${range.toDate}`);
  }, [lines, range.fromDate, range.toDate]);

  return (
    <>
      <div className="report-headline-row">
        <ReportStatCards variant="compact" items={cards} />
        <ReportStatsBar
          label={t("Thực thu")}
          value={summary?.actualReceived ?? 0}
          tone="green"
          loading={summaryLoading}
          onExport={handleExport}
        />
      </div>
      <div className="report-payment-layout">
        <ReportTableCard<PaymentLineVm>
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
        <DailyTotalsTable rows={data?.daily ?? []} valueLabel={t("Thực thu")} />
      </div>
    </>
  );
}
