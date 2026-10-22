import dayjs, { type Dayjs } from "dayjs";
import { t } from "@/lib/i18n";

/** Ngày / Tháng / Quý / Nửa năm / Năm: what one click on the grid picks. */
export type PeriodGrain = "day" | "month" | "quarter" | "half" | "year";

export const PERIOD_GRAINS: readonly PeriodGrain[] = ["day", "month", "quarter", "half", "year"];

/** A period as the picker hands it out: whole units, both ends inclusive. */
export interface PeriodRangeValue {
  grain: PeriodGrain;
  /** `YYYY-MM-DD`. */
  from: string;
  to: string;
  /** "So sánh kỳ trước". */
  compare: boolean;
}

export const ISO_DATE = "YYYY-MM-DD";

const MONTHS_IN: Record<Exclude<PeriodGrain, "day">, number> = { month: 1, quarter: 3, half: 6, year: 12 };

/** The first day of the unit holding `date`. */
export function unitStart(grain: PeriodGrain, date: Dayjs): Dayjs {
  if (grain === "day") return date.startOf("day");
  const months = MONTHS_IN[grain];
  return date.startOf("year").month(Math.floor(date.month() / months) * months);
}

/** The last day of the unit holding `date`. */
export function unitEnd(grain: PeriodGrain, date: Dayjs): Dayjs {
  if (grain === "day") return date.startOf("day");
  return unitStart(grain, date).add(MONTHS_IN[grain], "month").subtract(1, "day");
}

/** `count` units on from `date`'s unit. */
export function addUnits(grain: PeriodGrain, date: Dayjs, count: number): Dayjs {
  if (grain === "day") return date.add(count, "day");
  return unitStart(grain, date).add(count * MONTHS_IN[grain], "month");
}

export function sameUnit(grain: PeriodGrain, a: Dayjs, b: Dayjs): boolean {
  return unitStart(grain, a).isSame(unitStart(grain, b), "day");
}

/** How one unit reads: 05/10/2026, 10/2026, Quý 4/2026, Nửa năm 2/2026, 2026. */
export function unitLabel(grain: PeriodGrain, date: Dayjs): string {
  if (grain === "day") return date.format("DD/MM/YYYY");
  if (grain === "month") return date.format("MM/YYYY");
  if (grain === "quarter") return t("PeriodRange:QuarterOf", Math.floor(date.month() / 3) + 1, date.year());
  if (grain === "half") return t("PeriodRange:HalfOf", Math.floor(date.month() / 6) + 1, date.year());
  return String(date.year());
}

/** "01/10/2026 – 21/10/2026", or one label when the period is one unit. */
export function formatPeriodRange(grain: PeriodGrain, from: Dayjs, to: Dayjs): string {
  const start = unitLabel(grain, from);
  return sameUnit(grain, from, to) ? start : `${start} – ${unitLabel(grain, to)}`;
}

/**
 * The period "So sánh kỳ trước" sets beside the one picked: as long, and
 * ending the day before it starts — three quarters against the three before.
 */
export function previousPeriod(value: PeriodRangeValue): { from: string; to: string } {
  const from = dayjs(value.from);
  const to = dayjs(value.to);
  const start =
    value.grain === "day"
      ? from.subtract(to.diff(from, "day") + 1, "day")
      : from.subtract(to.add(1, "day").diff(from, "month"), "month");
  return { from: start.format(ISO_DATE), to: from.subtract(1, "day").format(ISO_DATE) };
}

export function periodDays(from: Dayjs, to: Dayjs): number {
  return to.diff(from, "day") + 1;
}

export interface PeriodPreset {
  key: "today" | "last7" | "last30" | "thisMonth" | "lastMonth";
  resolve: (today: Dayjs) => { from: Dayjs; to: Dayjs };
}

/** The chips over the calendar; each picks days. */
export const PERIOD_PRESETS: readonly PeriodPreset[] = [
  { key: "today", resolve: (today) => ({ from: today, to: today }) },
  { key: "last7", resolve: (today) => ({ from: today.subtract(6, "day"), to: today }) },
  { key: "last30", resolve: (today) => ({ from: today.subtract(29, "day"), to: today }) },
  { key: "thisMonth", resolve: (today) => ({ from: today.startOf("month"), to: today }) },
  {
    key: "lastMonth",
    resolve: (today) => {
      const last = today.subtract(1, "month");
      return { from: last.startOf("month"), to: last.endOf("month").startOf("day") };
    },
  },
];

/** BA (P2110): the bar opens on the current month up to today, compared with the period before. */
export function monthToDate(today: Dayjs = dayjs()): PeriodRangeValue {
  return {
    grain: "day",
    from: today.startOf("month").format(ISO_DATE),
    to: today.format(ISO_DATE),
    compare: true,
  };
}
