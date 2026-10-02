import { useEffect, useMemo } from "react";
import { useDentistList } from "@/features/staff/api/staffQueries";

interface DoctorOption {
  value: string;
  label: string;
}

interface KeptDoctor {
  id: string;
  name: string;
}

interface Args {
  /** "YYYY-MM-DD" — the day being booked. */
  date: string;
  doctorId: string;
  /**
   * The doctor an existing booking already holds. Shown even when that doctor
   * has since gone OFF, so editing never blanks a saved choice; never offered
   * to anyone else.
   */
  kept?: KeptDoctor | null;
  /** The selected doctor is OFF on `date` — the caller clears the field. */
  onUnavailable: () => void;
}

/**
 * Doctors a booking can go to on a given day: everyone not registered OFF
 * that day on Chấm công (BA 2026-10-02). Changing the date to a day the
 * chosen doctor is off reports it once the new day's list has arrived.
 */
export function useBookableDoctorOptions({ date, doctorId, kept, onUnavailable }: Args) {
  const query = useDentistList(date || undefined);
  const { data: dentists, isSuccess, isFetching } = query;

  const options = useMemo<DoctorOption[]>(() => {
    const listed = (dentists ?? []).map((d) => ({ value: d.id, label: d.name }));
    if (!kept || listed.some((o) => o.value === kept.id)) return listed;
    return [...listed, { value: kept.id, label: kept.name }];
  }, [dentists, kept]);

  const settled = isSuccess && !isFetching;
  const unavailable = settled && Boolean(doctorId) && !options.some((o) => o.value === doctorId);

  useEffect(() => {
    if (unavailable) onUnavailable();
  }, [unavailable, onUnavailable]);

  return options;
}
