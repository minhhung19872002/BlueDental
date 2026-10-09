import { useCallback, useEffect, useMemo, useState } from "react";
import { useDebounce } from "@/hooks/useDebounce";
import { toRecurrenceRequest } from "../api/appointmentSeriesAdapters";
import type { AppointmentEditorValues } from "../types/appointmentEditor";
import { DEFAULT_RECURRENCE, type RecurrenceValues, type SeriesPreviewRequest } from "../types/appointmentSeries";
import { slotOf } from "./useSaveAppointment";

/** The part of the booking a series is laid out from. */
export type RecurrenceBooking = Pick<
  AppointmentEditorValues,
  "patientId" | "doctorId" | "date" | "startTime" | "durationMinutes"
>;

const PREVIEW_DEBOUNCE_MS = 300;

/**
 * The "Lặp lại lịch hẹn" controls of one dialog opening, and the preview
 * request they make together with the booking. The request stays null until
 * the server has enough to lay the sessions out.
 */
export function useRecurrence(booking: RecurrenceBooking, open: boolean) {
  const [values, setValues] = useState<RecurrenceValues>(DEFAULT_RECURRENCE);

  useEffect(() => {
    if (!open) setValues(DEFAULT_RECURRENCE);
  }, [open]);

  const patch = useCallback((change: Partial<RecurrenceValues>) => {
    setValues((current) => ({ ...current, ...change }));
  }, []);

  const { patientId, doctorId, date, startTime, durationMinutes } = booking;
  const previewInput = useMemo<SeriesPreviewRequest | null>(() => {
    if (!values.enabled || !patientId || !doctorId || !date || !startTime) return null;
    if (values.endKind === "until" && !values.until) return null;
    const slot = slotOf({ date, startTime, durationMinutes });
    return { patientId, doctorId, ...slot, recurrence: toRecurrenceRequest(values) };
  }, [values, patientId, doctorId, date, startTime, durationMinutes]);

  return { values, patch, previewInput: useDebounce(previewInput, PREVIEW_DEBOUNCE_MS) };
}
