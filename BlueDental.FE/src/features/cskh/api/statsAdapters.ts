import dayjs from "dayjs";
import type { StatsDay, StatsTotals } from "./statsApi";

/** Past about two months, daily bars get too thin to read: the chart sums them by month. */
export const DAILY_CHART_MAX_DAYS = 62;

export interface StatsBar extends StatsTotals {
  key: string;
  label: string;
  /** Today's bar, or this month's: the one drawn darker. */
  current: boolean;
}

export interface StatsChart {
  grain: "day" | "month";
  bars: StatsBar[];
  /** Whether one of the bars is today / this month, so the hint can say so. */
  hasCurrent: boolean;
}

/** `part / whole` as a percentage, or null when nothing was sent. */
export function ratePercent(part: number, whole: number): number | null {
  return whole > 0 ? (part / whole) * 100 : null;
}

function sum(days: StatsDay[]): StatsTotals {
  return days.reduce(
    (acc, day) => ({
      sent: acc.sent + day.sent,
      succeeded: acc.succeeded + day.succeeded,
      failed: acc.failed + day.failed,
    }),
    { sent: 0, succeeded: 0, failed: 0 },
  );
}

/** One bar a day, or a month when the period is longer than {@link DAILY_CHART_MAX_DAYS}. */
export function toStatsChart(days: StatsDay[], today: dayjs.Dayjs): StatsChart {
  if (days.length <= DAILY_CHART_MAX_DAYS) {
    const bars = days.map((day) => ({
      ...day,
      key: day.date,
      label: dayjs(day.date).format("DD/MM"),
      current: dayjs(day.date).isSame(today, "day"),
    }));
    return { grain: "day", bars, hasCurrent: bars.some((bar) => bar.current) };
  }

  const months = new Map<string, StatsDay[]>();
  for (const day of days) {
    const key = day.date.slice(0, 7);
    months.set(key, [...(months.get(key) ?? []), day]);
  }
  const bars = [...months].map(([key, ofMonth]) => ({
    ...sum(ofMonth),
    key,
    label: dayjs(`${key}-01`).format("MM/YYYY"),
    current: dayjs(`${key}-01`).isSame(today, "month"),
  }));
  return { grain: "month", bars, hasCurrent: bars.some((bar) => bar.current) };
}
