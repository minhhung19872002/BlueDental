import dayjs from "dayjs";
import { t } from "@/lib/i18n";
import type { TelesaleBreakdownRowDto, TelesaleDayPointDto } from "../api/customerReportApi";
import type { ChartSeries } from "./ReportChartCard";
import type { StatCardItem } from "./ReportStatCards";
import type { TrendPoint } from "./ReportTrendBars";
import { percent } from "./reportCountColumns";

export type TicketStatusKey = "arrived" | "booked" | "inCare" | "new" | "notPotential";

/**
 * Ticket states, ordered so neighbouring segments stay apart for colour-blind
 * readers (palette checked with the dataviz validator, 2026-10-08).
 */
export function ticketStatusSeries(): ChartSeries<TicketStatusKey>[] {
  return [
    { key: "arrived", label: t("Ticket:Status:Arrived"), tone: "green" },
    { key: "booked", label: t("Ticket:Status:Booked"), tone: "blue" },
    { key: "inCare", label: t("Ticket:Status:InCare"), tone: "gold" },
    { key: "new", label: t("Ticket:Status:New"), tone: "violet" },
    { key: "notPotential", label: t("Ticket:Status:NotPotential"), tone: "red" },
  ];
}

/** Đặt lịch rate: booked or already arrived, out of every lead of the row. */
export function bookingRate(row: TelesaleBreakdownRowDto): number {
  return percent(row.booked + row.arrived, row.total);
}

export function telesaleTiles(summary: TelesaleBreakdownRowDto): StatCardItem[] {
  return [
    { label: t("Report:Telesale:Total"), value: summary.total, tone: "ink", format: "count" },
    { label: t("Ticket:Status:New"), value: summary.new, tone: "violet", format: "count" },
    { label: t("Ticket:Status:InCare"), value: summary.inCare, tone: "gold", format: "count" },
    { label: t("Ticket:Status:Booked"), value: summary.booked, tone: "blue", format: "count" },
    { label: t("Ticket:Status:Arrived"), value: summary.arrived, tone: "green", format: "count" },
    { label: t("Ticket:Status:NotPotential"), value: summary.notPotential, tone: "red", format: "count" },
    { label: t("Report:Telesale:Overdue"), value: summary.overdue, tone: "red", format: "count" },
    { label: t("Report:Telesale:ConversionShort"), value: bookingRate(summary), tone: "green", format: "percent" },
  ];
}

export function telesaleTrendSeries(): ChartSeries[] {
  return [
    { key: "total", label: t("Report:Telesale:Total"), tone: "ink" },
    { key: "booked", label: t("Ticket:Status:Booked"), tone: "blue" },
    { key: "arrived", label: t("Ticket:Status:Arrived"), tone: "green" },
  ];
}

/**
 * Every day of the period gets a bar, empty ones included, so a quiet week
 * reads as quiet rather than as missing. A year is shown by month.
 */
export function buildTelesaleTrend(points: TelesaleDayPointDto[], fromDate: string, toDate: string): TrendPoint[] {
  const start = dayjs(fromDate);
  const end = dayjs(toDate);
  const byMonth = end.diff(start, "day") > 31;
  const unit = byMonth ? "month" : "day";
  const bucketOf = (date: string) => dayjs(date).startOf(unit).format("YYYY-MM-DD");

  const buckets = new Map<string, TrendPoint>();
  for (let cursor = start.startOf(unit); !cursor.isAfter(end); cursor = cursor.add(1, unit)) {
    buckets.set(cursor.format("YYYY-MM-DD"), {
      label: cursor.format(byMonth ? "MM/YYYY" : "DD/MM"),
      total: 0,
      booked: 0,
      arrived: 0,
    });
  }

  for (const p of points) {
    const bucket = buckets.get(bucketOf(p.date));
    if (!bucket) continue;
    bucket.total = Number(bucket.total) + p.total;
    bucket.booked = Number(bucket.booked) + p.booked;
    bucket.arrived = Number(bucket.arrived) + p.arrived;
  }

  return [...buckets.values()];
}
