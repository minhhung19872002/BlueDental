import { useCallback, useMemo } from "react";
import type { Dayjs } from "dayjs";
import { useDentistBusySpans, useDentistWorkDays } from "../api/receptionQueries";
import type { BusySpan } from "../types/reception";

const DAY_FORMAT = "YYYY-MM-DD";
const NO_BUSY: BusySpan[] = [];

/**
 * A doctor's shifts and bookings for the week starting `monday`. Without a
 * doctor there is nothing to show: no shifts, no bookings.
 */
export function useDoctorWeek(doctorId: string | undefined, monday: Dayjs) {
  const from = monday.format(DAY_FORMAT);
  const to = monday.add(6, "day").format(DAY_FORMAT);
  const busyQuery = useDentistBusySpans(doctorId, from, to);
  const workQuery = useDentistWorkDays(doctorId, from, to);

  const byDate = useMemo(() => new Map((workQuery.data ?? []).map((d) => [d.date, d])), [workQuery.data]);
  const workDayOf = useCallback(
    (day: Dayjs) => (doctorId ? byDate.get(day.format(DAY_FORMAT)) : undefined),
    [byDate, doctorId],
  );

  return {
    busy: doctorId ? (busyQuery.data ?? NO_BUSY) : NO_BUSY,
    workDayOf,
    loading: !!doctorId && (busyQuery.isFetching || workQuery.isFetching),
  };
}

export type DoctorWeek = ReturnType<typeof useDoctorWeek>;
