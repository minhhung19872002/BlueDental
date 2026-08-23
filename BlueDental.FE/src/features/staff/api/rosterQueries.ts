import dayjs from "dayjs";
import { useTimeKeepingList } from "@/features/timekeeping/api/timekeepingQueries";
import {
  WORK_REGISTRATION,
  type TimeKeepingRecordDto,
} from "@/features/timekeeping/api/timekeepingApi";

/** Mon–Sat, the six columns the design puts on each staff card. */
export const ROSTER_DAYS = 6;

export interface RosterDay {
  /** "YYYY-MM-DD" */
  date: string;
  /** T2…T7, as the roster labels them. */
  label: string;
  /** The attendance record for this staff on this day, if one exists yet. */
  record: TimeKeepingRecordDto | null;
  working: boolean;
}

export function weekStartOf(date: dayjs.Dayjs): dayjs.Dayjs {
  // dayjs weeks start on Sunday; the clinic's roster starts on Monday.
  const day = date.day();
  return date.subtract(day === 0 ? 6 : day - 1, "day").startOf("day");
}

/**
 * One request covers the whole week, because the attendance list takes a date
 * range — so a card can show six days without six round trips.
 */
export function useWeekRoster(clinicBranchId: string, weekStart: dayjs.Dayjs) {
  const from = weekStart.format("YYYY-MM-DD");
  const to = weekStart.add(ROSTER_DAYS - 1, "day").format("YYYY-MM-DD");

  const { data, isLoading } = useTimeKeepingList({
    clinicBranchId,
    fromDate: from,
    toDate: to,
    maxResultCount: 500,
  });

  const byStaffDay = new Map<string, TimeKeepingRecordDto>();
  for (const rec of data?.items ?? []) {
    byStaffDay.set(`${rec.staffId}|${rec.workDate.slice(0, 10)}`, rec);
  }

  const daysFor = (staffId: string): RosterDay[] =>
    Array.from({ length: ROSTER_DAYS }, (_, i) => {
      const day = weekStart.add(i, "day");
      const date = day.format("YYYY-MM-DD");
      const record = byStaffDay.get(`${staffId}|${date}`) ?? null;
      return {
        date,
        label: `T${i + 2}`,
        record,
        working: record?.registration === WORK_REGISTRATION.Working,
      };
    });

  return { daysFor, isLoading, from, to };
}
