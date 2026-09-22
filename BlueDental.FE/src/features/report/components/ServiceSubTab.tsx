import { useCallback } from "react";
import { t } from "@/lib/i18n";
import { useServiceLines, useSalesSummary, type RangeQuery } from "../api/clinicReportApi";
import { exportServiceLines } from "./serviceExport";
import { ReportStatsBar } from "./ReportStatsBar";
import { ExpenseTable } from "./ExpenseTable";

/**
 * "Xuất Excel" + the orange "Doanh số" pill. The reference puts them on the
 * sub-pill row itself, so the parent renders this as that row's `extra`.
 */
export function ServiceSubTabActions(range: RangeQuery) {
  const { data: lines = [] } = useServiceLines(range);
  const { data: summary, isLoading } = useSalesSummary(range);

  const handleExport = useCallback(() => exportServiceLines(lines), [lines]);

  return (
    <ReportStatsBar
      label={t("Doanh số")}
      value={summary?.revenue ?? 0}
      tone="gold"
      loading={isLoading}
      onExport={handleExport}
    />
  );
}

/** Sub-tab "Khách hàng phát sinh dịch vụ": the grouped service table. */
export function ServiceSubTab(range: RangeQuery) {
  const { data: lines = [], isLoading } = useServiceLines(range);
  return <ExpenseTable data={lines} loading={isLoading} />;
}
