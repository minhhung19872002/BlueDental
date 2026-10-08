import { useMemo } from "react";
import { Button, Spin } from "antd";
import { DownloadOutlined } from "@ant-design/icons";
import { PillTabs } from "@/components/PillTabs";
import { t } from "@/lib/i18n";
import type { RangeQuery } from "../api/clinicReportApi";
import { useCareReport, useExportCareReport, type CareReportRowDto } from "../api/customerReportApi";
import { REPORT_PERMISSION, useReportPermission } from "../hooks/useReportPermissions";
import { ReportChartCard } from "./ReportChartCard";
import { ReportDonut } from "./ReportDonut";
import { ReportStackedBars, type StackedBarRow } from "./ReportStackedBars";
import { ReportStatCards } from "./ReportStatCards";
import { ReportTableCard } from "./ReportTableCard";
import {
  careColumns,
  careOutcomeSlices,
  careStatusSeries,
  careTiles,
  careTypeLabel,
  type NamedCareRow,
} from "./careReportConfig";

function stackedRow(name: string, r: CareReportRowDto): StackedBarRow {
  return { name, succeeded: r.succeeded, contacted: r.contacted, new: r.new, cancelled: r.cancelled, failed: r.failed };
}

/**
 * Tab "Chăm sóc khách hàng" (checklist 16.11, BlueDental-local): every CSKH
 * type counted over the same window as its /cskh-grouping tab.
 */
export function CareReportTab(range: RangeQuery) {
  const { data, isLoading } = useCareReport(range);
  const canExport = useReportPermission(REPORT_PERMISSION.careExport);
  const exportMutation = useExportCareReport();

  const view = useMemo(() => {
    if (!data) return undefined;
    const types: NamedCareRow[] = data.byType.map((r) => ({ ...r, rowKey: String(r.type), label: careTypeLabel(r.type) }));
    const staff: NamedCareRow[] = data.byStaff.map((r) => ({
      ...r,
      rowKey: r.staffId ?? "none",
      label: r.name ?? t(r.staffId ? "Report:Unknown" : "Report:Care:NoStaff"),
    }));
    return {
      tiles: careTiles(data.summary),
      types,
      staff,
      typeBars: types.map((r) => stackedRow(r.label, r)),
      staffBars: staff.map((r) => stackedRow(r.label, r)),
      outcome: careOutcomeSlices(data.byOutcome),
    };
  }, [data]);

  if (isLoading || !view) {
    return (
      <div className="report-tab report-overview-loading">
        <Spin />
      </div>
    );
  }

  const series = careStatusSeries();
  const table = (rows: NamedCareRow[], nameTitle: string) => (
    <ReportTableCard<NamedCareRow> rowKey="rowKey" columns={careColumns(nameTitle)} dataSource={rows} pagination={false} size="small" />
  );

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
        <ReportChartCard title={t("Report:Care:ByType")} extra={<span className="report-chart-note">{t("Report:Care:Note")}</span>}>
          <ReportStackedBars rows={view.typeBars} series={series} labelWidth={160} maxRows={9} />
        </ReportChartCard>
        <ReportChartCard title={t("Report:Care:ByOutcome")}>
          <ReportDonut slices={view.outcome} centerLabel={t("Report:Care:Succeeded")} />
        </ReportChartCard>
      </div>

      <ReportChartCard title={t("Report:Care:ByStaff")}>
        <ReportStackedBars rows={view.staffBars} series={series} labelWidth={180} />
      </ReportChartCard>

      <PillTabs
        className="report-breakdown-tabs"
        items={[
          { key: "type", label: t("Report:Care:ByType"), children: table(view.types, t("Report:Care:Type")) },
          { key: "staff", label: t("Report:Care:ByStaff"), children: table(view.staff, t("Report:Care:Staff")) },
        ]}
      />
    </div>
  );
}
