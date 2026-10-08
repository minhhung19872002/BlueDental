import { useMemo } from "react";
import { Button, Spin } from "antd";
import { DownloadOutlined } from "@ant-design/icons";
import { t } from "@/lib/i18n";
import type { RangeQuery } from "../api/clinicReportApi";
import { REPORT_TICKET_CHANNEL, useExportTelesaleReport, useTelesaleReport, type TelesaleBreakdownRowDto } from "../api/customerReportApi";
import { REPORT_PERMISSION, useReportPermission } from "../hooks/useReportPermissions";
import { ReportChartCard } from "./ReportChartCard";
import { ReportDonut, type DonutSlice } from "./ReportDonut";
import { ReportStackedBars, type StackedBarRow } from "./ReportStackedBars";
import { ReportStatCards } from "./ReportStatCards";
import { ReportTrendBars } from "./ReportTrendBars";
import { TelesaleBreakdownTables } from "./TelesaleBreakdownTables";
import { buildTelesaleTrend, telesaleTiles, telesaleTrendSeries, ticketStatusSeries } from "./telesaleReportConfig";

const CHANNEL_TONES = { 1: "blue", 2: "gold", 3: "green" } as const;

function stackedRows<T extends TelesaleBreakdownRowDto>(rows: T[], nameOf: (row: T) => string): StackedBarRow[] {
  return rows.map((r) => ({
    name: nameOf(r),
    arrived: r.arrived,
    booked: r.booked,
    inCare: r.inCare,
    new: r.new,
    notPotential: r.notPotential,
  }));
}

/**
 * Tab "Telesale - follow khách hàng" (checklist 16.8, BlueDental-local):
 * tickets received in the period, each counted in the state it is in today.
 */
export function TelesaleReportTab(range: RangeQuery) {
  const { data, isLoading } = useTelesaleReport(range);
  const canExport = useReportPermission(REPORT_PERMISSION.telesaleExport);
  const exportMutation = useExportTelesaleReport();

  const view = useMemo(() => {
    if (!data) return undefined;
    const statusSeries = ticketStatusSeries();
    return {
      statusSeries,
      tiles: telesaleTiles(data.summary),
      trend: buildTelesaleTrend(data.byDay, range.fromDate, range.toDate),
      statusSlices: statusSeries.map((s): DonutSlice => ({ ...s, value: data.summary[s.key] })),
      sources: stackedRows(data.bySource, (r) => r.name ?? t("Report:Telesale:NoSource")),
      files: stackedRows(data.byFile, (r) => r.name ?? ""),
      assignees: stackedRows(data.byAssignee, (r) => r.name ?? t(r.id ? "Report:Unknown" : "Report:Telesale:Unassigned")),
      customerTypes: data.byCustomerType.map((r): DonutSlice => ({
        key: String(r.isReturningCustomer),
        label: t(r.isReturningCustomer ? "Report:Telesale:Returning" : "Report:Telesale:New"),
        value: r.total,
        tone: r.isReturningCustomer ? "green" : "gold",
      })),
      channels: data.byChannel.map((r): DonutSlice => ({
        key: String(r.channel),
        label: t(`Ticket:Channel:${REPORT_TICKET_CHANNEL[r.channel]}`),
        value: r.total,
        tone: CHANNEL_TONES[r.channel],
      })),
    };
  }, [data, range.fromDate, range.toDate]);

  if (isLoading || !data || !view) {
    return (
      <div className="report-tab report-overview-loading">
        <Spin />
      </div>
    );
  }

  const centerLabel = t("Report:Telesale:Total");

  return (
    <div className="report-tab report-insight">
      <div className="report-insight-head">
        <ReportStatCards variant="compact" items={view.tiles} />
        {canExport && (
          <Button
            icon={<DownloadOutlined />}
            className="report-btn--blue"
            loading={exportMutation.isPending}
            disabled={exportMutation.isPending}
            onClick={() => exportMutation.mutate(range)}
          >
            {t("Report:Action:ExportExcel")}
          </Button>
        )}
      </div>

      <div className="report-insight-grid report-insight-grid--wide">
        <ReportChartCard title={t("Report:Telesale:ByDay")}>
          <ReportTrendBars points={view.trend} series={telesaleTrendSeries()} />
        </ReportChartCard>
        <ReportChartCard title={t("Report:Telesale:ByStatus")}>
          <ReportDonut slices={view.statusSlices} centerLabel={centerLabel} />
        </ReportChartCard>
      </div>

      <div className="report-insight-grid">
        <ReportChartCard title={t("Report:Telesale:BySource")}>
          <ReportStackedBars rows={view.sources} series={view.statusSeries} />
        </ReportChartCard>
        <ReportChartCard title={t("Report:Telesale:ByFile")}>
          <ReportStackedBars rows={view.files} series={view.statusSeries} />
        </ReportChartCard>
      </div>

      <div className="report-insight-grid report-insight-grid--trio">
        <ReportChartCard title={t("Report:Telesale:ByCustomerType")}>
          <ReportDonut slices={view.customerTypes} centerLabel={centerLabel} />
        </ReportChartCard>
        <ReportChartCard title={t("Report:Telesale:ByChannel")}>
          <ReportDonut slices={view.channels} centerLabel={centerLabel} />
        </ReportChartCard>
        <ReportChartCard title={t("Report:Telesale:ByAssignee")}>
          <ReportStackedBars rows={view.assignees} series={view.statusSeries} />
        </ReportChartCard>
      </div>

      <TelesaleBreakdownTables report={data} />
    </div>
  );
}
