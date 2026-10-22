import dayjs from "dayjs";
import { t } from "@/lib/i18n";
import { PageHeader } from "@/components/PageHeader";
import { formatPeriodRange } from "@/components/PeriodRangePicker";
import { useAbility } from "@/hooks/useAbility";
import { useStatsOverview, useStatsTemplateOptions } from "../api/statsApi";
import { useStatsFilters } from "../hooks/useStatsFilters";
import { useStatsRecipientQuery } from "../hooks/useStatsRecipientQuery";
import { StatsChannelBars } from "../components/stats/StatsChannelBars";
import { StatsDayChart } from "../components/stats/StatsDayChart";
import { StatsExportButton } from "../components/stats/StatsExportButton";
import { StatsFilterBar } from "../components/stats/StatsFilterBar";
import { StatsHistoryTable } from "../components/stats/StatsHistoryTable";
import { StatsKpis } from "../components/stats/StatsKpis";
import { StatsRecipientsCard } from "../components/stats/StatsRecipientsCard";
import { StatsTemplateTable } from "../components/stats/StatsTemplateTable";
import "../components/cskh.css";
import "../components/cskh-stats.css";

/**
 * /dashboard/cskh — Tổng quan ▸ Thống kê CSKH (BA P2110 img_31 / img_32):
 * what went out, on which channel, with which template, to whom, and how it
 * ended. The filter row drives every block below it and the Excel.
 */
export function CskhStatsPage() {
  const filters = useStatsFilters();
  const search = useStatsRecipientQuery();
  const { canExport } = useAbility("cskhStats");
  const templateOptions = useStatsTemplateOptions();
  const overview = useStatsOverview(filters.overviewInput);
  const filterKey = JSON.stringify(filters.filter);
  const periodLabel = formatPeriodRange(filters.period.grain, dayjs(filters.period.from), dayjs(filters.period.to));
  const loading = overview.isFetching;

  return (
    <div className="page-container cskh-stats-page">
      <PageHeader
        title={t("CSKH:Stats:PageTitle")}
        actions={canExport ? <StatsExportButton filter={filters.filter} query={search.query} /> : undefined}
      />
      <StatsFilterBar
        filters={filters}
        templates={templateOptions.data ?? []}
        templatesLoading={templateOptions.isLoading}
      />
      <StatsKpis totals={overview.data?.totals} previous={overview.data?.previous} loading={loading} />
      <div className="cskh-stats-split">
        <StatsDayChart days={overview.data?.days ?? []} periodLabel={periodLabel} loading={loading} />
        <StatsChannelBars channels={overview.data?.channels ?? []} loading={loading} />
      </div>
      {/* Siblings: each needs its own key, or React keeps the stale table on a filter change. */}
      <StatsTemplateTable key={`templates:${filterKey}`} templates={overview.data?.templates ?? []} loading={loading} />
      <StatsHistoryTable key={`history:${filterKey}`} filter={filters.filter} />
      <StatsRecipientsCard filter={filters.filter} search={search} />
    </div>
  );
}
