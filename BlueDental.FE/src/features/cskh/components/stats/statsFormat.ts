import { getLocale } from "@/lib/i18n";

/** Number formats of Thống kê CSKH, in the viewer's language. */
export function formatCount(value: number): string {
  return value.toLocaleString(getLocale());
}

/** 96,4% — one decimal at most, a dash when there is nothing to divide by. */
export function formatPercent(value: number | null): string {
  if (value === null) return "—";
  return new Intl.NumberFormat(getLocale(), { style: "percent", maximumFractionDigits: 1 }).format(value / 100);
}

/** "+12%" against the previous period, or null when that period sent nothing. */
export function formatDelta(current: number, previous: number): string | null {
  if (previous === 0) return null;
  return new Intl.NumberFormat(getLocale(), {
    style: "percent",
    maximumFractionDigits: 1,
    signDisplay: "exceptZero",
  }).format((current - previous) / previous);
}
