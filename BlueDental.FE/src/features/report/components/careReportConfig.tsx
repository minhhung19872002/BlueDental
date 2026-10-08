import type { ColumnsType } from "antd/es/table";
import { t } from "@/lib/i18n";
import { REPORT_CARE_TYPE, type CareOutcomeCountsDto, type CareReportRowDto, type ReportCareType } from "../api/customerReportApi";
import type { ChartSeries } from "./ReportChartCard";
import type { DonutSlice } from "./ReportDonut";
import type { StatCardItem } from "./ReportStatCards";
import { countColumn, percent, rateColumn } from "./reportCountColumns";

export type CareStatusKey = "succeeded" | "contacted" | "new" | "cancelled" | "failed";

/** Same five tones, same order, as the telesale states (dataviz validator, 2026-10-08). */
export function careStatusSeries(): ChartSeries<CareStatusKey>[] {
  return [
    { key: "succeeded", label: t("Report:Care:Succeeded"), tone: "green" },
    { key: "contacted", label: t("Report:Care:Contacted"), tone: "blue" },
    { key: "new", label: t("Report:Care:New"), tone: "gold" },
    { key: "cancelled", label: t("Report:Care:Cancelled"), tone: "violet" },
    { key: "failed", label: t("Report:Care:Failed"), tone: "red" },
  ];
}

export function careTypeLabel(type: ReportCareType): string {
  return t(`CSKH:Type:${REPORT_CARE_TYPE[type]}`);
}

/** Đã chăm sóc: reached in any way, out of the tasks that were not cancelled. */
export function careDoneRate(row: CareReportRowDto): number {
  return percent(row.contacted + row.succeeded + row.failed, row.total - row.cancelled);
}

export function careTiles(summary: CareReportRowDto): StatCardItem[] {
  return [
    { label: t("Report:Care:Total"), value: summary.total, tone: "ink", format: "count" },
    { label: t("Report:Care:New"), value: summary.new, tone: "gold", format: "count" },
    { label: t("Report:Care:Contacted"), value: summary.contacted, tone: "blue", format: "count" },
    { label: t("Report:Care:Succeeded"), value: summary.succeeded, tone: "green", format: "count" },
    { label: t("Report:Care:Failed"), value: summary.failed, tone: "red", format: "count" },
    { label: t("Report:Care:Cancelled"), value: summary.cancelled, tone: "violet", format: "count" },
    { label: t("Report:Care:ZaloSent"), value: summary.zaloSent, tone: "blue", format: "count" },
    { label: t("Report:Care:DoneRateShort"), value: careDoneRate(summary), tone: "green", format: "percent" },
  ];
}

export function careOutcomeSlices(outcome: CareOutcomeCountsDto): DonutSlice[] {
  return [
    { key: "good", label: t("CSKH:Outcome:Good"), value: outcome.good, tone: "green" },
    { key: "fair", label: t("CSKH:Outcome:Fair"), value: outcome.fair, tone: "blue" },
    { key: "normal", label: t("CSKH:Outcome:Normal"), value: outcome.normal, tone: "gold" },
    { key: "notRated", label: t("Report:Care:NotRated"), value: outcome.notRated, tone: "violet" },
    { key: "complaint", label: t("CSKH:Outcome:Complaint"), value: outcome.complaint, tone: "red" },
  ];
}

/** A care row with the name it is shown under (loại hình or nhân viên). */
export type NamedCareRow = CareReportRowDto & { rowKey: string; label: string };

export function careColumns(nameTitle: string): ColumnsType<NamedCareRow> {
  return [
    { key: "label", dataIndex: "label", title: nameTitle, fixed: "left", width: 220, ellipsis: true },
    countColumn<NamedCareRow>("total", t("Report:Care:Total"), "ink"),
    countColumn<NamedCareRow>("new", t("Report:Care:New"), "gold"),
    countColumn<NamedCareRow>("contacted", t("Report:Care:Contacted"), "blue"),
    countColumn<NamedCareRow>("succeeded", t("Report:Care:Succeeded"), "green"),
    countColumn<NamedCareRow>("failed", t("Report:Care:Failed"), "red"),
    countColumn<NamedCareRow>("cancelled", t("Report:Care:Cancelled")),
    countColumn<NamedCareRow>("zaloSent", t("Report:Care:ZaloSent"), "blue"),
    rateColumn<NamedCareRow>(t("Report:Care:DoneRateShort"), careDoneRate),
  ];
}
