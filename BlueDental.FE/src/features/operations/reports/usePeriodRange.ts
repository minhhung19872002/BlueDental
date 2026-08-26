import { useCallback, useMemo, useState } from "react";
import { t } from "@/lib/i18n";

/**
 * The window a Vận hành report is read through.
 *
 * The reference gives every report the same Ngày / Tuần / Tháng / Năm switch
 * with a stepper beside it, so a report always shows one whole period and the
 * arrows walk to the next or previous one. The server squares the anchor date
 * to the period, so all this has to carry is which period and which date.
 */
export type ReportPeriod = "day" | "week" | "month" | "year";

/** What the API expects — the reference's own order. */
export const PERIOD_CODES: Record<ReportPeriod, number> = {
  day: 1,
  week: 2,
  month: 3,
  year: 4,
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function startOfWeek(date: Date): Date {
  // Monday, as the reference's stepper moves.
  const offset = (date.getDay() + 6) % 7;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() - offset);
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/** `YYYY-MM-DD` in the browser's own day, not shifted into UTC. */
export function toIsoDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** How the reference labels the window currently being read. */
export function formatPeriod(period: ReportPeriod, anchor: Date): string {
  if (period === "day") {
    return `${pad(anchor.getDate())}/${pad(anchor.getMonth() + 1)}/${anchor.getFullYear()}`;
  }

  if (period === "week") {
    const start = startOfWeek(anchor);
    const end = new Date(start.getTime() + 6 * MS_PER_DAY);
    return `${pad(start.getDate())}/${pad(start.getMonth() + 1)} – ${pad(end.getDate())}/${pad(
      end.getMonth() + 1,
    )}/${end.getFullYear()}`;
  }

  if (period === "month") {
    return `${pad(anchor.getMonth() + 1)}/${anchor.getFullYear()}`;
  }

  return String(anchor.getFullYear());
}

export interface PeriodRange {
  period: ReportPeriod;
  anchor: Date;
  /** What the API is sent. */
  periodCode: number;
  anchorIso: string;
  label: string;
  setPeriod: (period: ReportPeriod) => void;
  /** Jump straight to a date, as the picker does. */
  setAnchor: (date: Date) => void;
  step: (direction: -1 | 1) => void;
}

/** Labels for the switch, in the reference's order. */
export function periodOptions(): { key: ReportPeriod; label: string }[] {
  return [
    { key: "day", label: t("Ngày") },
    { key: "week", label: t("Tuần") },
    { key: "month", label: t("Tháng") },
    { key: "year", label: t("Năm") },
  ];
}

export function usePeriodRange(initial: ReportPeriod = "month"): PeriodRange {
  const [period, setPeriod] = useState<ReportPeriod>(initial);
  const [anchor, setAnchor] = useState(() => new Date());

  const step = useCallback(
    (direction: -1 | 1) => {
      setAnchor((current) => {
        const next = new Date(current);

        if (period === "day") next.setDate(next.getDate() + direction);
        else if (period === "week") next.setDate(next.getDate() + direction * 7);
        else if (period === "month") next.setMonth(next.getMonth() + direction);
        else next.setFullYear(next.getFullYear() + direction);

        return next;
      });
    },
    [period],
  );

  return useMemo(
    () => ({
      period,
      anchor,
      periodCode: PERIOD_CODES[period],
      anchorIso: toIsoDate(anchor),
      label: formatPeriod(period, anchor),
      setPeriod,
      setAnchor,
      step,
    }),
    [period, anchor, step],
  );
}
