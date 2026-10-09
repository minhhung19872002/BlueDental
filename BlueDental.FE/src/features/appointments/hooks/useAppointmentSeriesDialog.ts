import { useCallback, useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import { extractApiError } from "@/lib/apiError";
import { toRecurrenceRequest } from "../api/appointmentSeriesAdapters";
import {
  useAppointmentSeries,
  useCreateAppointmentSeries,
  useSeriesPreview,
} from "../api/appointmentSeriesQueries";
import type { AppointmentEditorValues } from "../types/appointmentEditor";
import type { CalendarFocus, SeriesSession } from "../types/appointmentSeries";
import { slotOf } from "./useSaveAppointment";
import { useRecurrence, type RecurrenceBooking } from "./useRecurrence";

interface Options {
  open: boolean;
  /** The edited booking; absent while creating. */
  editing?: { id: string; seriesId: string | null };
  booking: RecurrenceBooking;
}

/**
 * "Lặp lại lịch hẹn" in the booking dialog. Creating, the rule's sessions are
 * previewed and saved together; editing one session of a series, the series
 * is shown read-only and only that session is saved, the usual way.
 */
export function useAppointmentSeriesDialog({ open, editing, booking }: Options) {
  const recurrence = useRecurrence(booking, open);
  const inSeries = Boolean(editing?.seriesId);
  const active = editing ? inSeries : recurrence.values.enabled;

  const preview = useSeriesPreview(editing ? null : recurrence.previewInput);
  const series = useAppointmentSeries(editing?.id ?? "", inSeries);
  const source = editing ? series : preview;
  const waitingForBooking = active && !editing && recurrence.previewInput === null;
  // keepPreviousData would otherwise keep the last rule's rows on screen
  // after, say, the time is cleared.
  const sessions = useMemo<SeriesSession[]>(
    () => (active && !waitingForBooking ? source.data?.sessions ?? [] : []),
    [active, waitingForBooking, source.data],
  );

  const [focus, setFocus] = useState<CalendarFocus | null>(null);
  useEffect(() => {
    if (!open) setFocus(null);
  }, [open]);
  const selectSession = useCallback((session: SeriesSession) => {
    setFocus({ start: session.start, end: session.end });
  }, []);

  const create = useCreateAppointmentSeries();
  const saveSeries = useCallback(
    async (data: AppointmentEditorValues) => {
      const created = await create.mutateAsync({
        patientId: data.patientId,
        doctorId: data.doctorId,
        branchId: data.branchId,
        ...slotOf(data),
        reason: data.content || undefined,
        color: data.color || undefined,
        notes: data.notes || undefined,
        recurrence: toRecurrenceRequest(recurrence.values),
      });
      return created.sessions.length;
    },
    [create, recurrence.values],
  );

  const current = editing ? sessions.find((s) => s.appointmentId === editing.id) : undefined;
  const first = sessions[0];
  const last = sessions[sessions.length - 1];

  return {
    recurrence,
    active,
    /** Editing a series session: the box stays ticked and the rule cannot change. */
    locked: inSeries,
    sessions,
    currentAppointmentId: editing?.id ?? null,
    loading: active && source.isFetching,
    /** Creating, before patient, dentist, date and time are all picked. */
    waitingForBooking,
    errorMessage: active && source.error ? extractApiError(source.error) : null,
    hasConflict: sessions.some((s) => s.state === "conflict"),
    currentFinished: current?.state === "finished",
    range: first && last ? { from: dayjs(first.start), to: dayjs(last.start) } : null,
    focus,
    selectSession,
    saveSeries,
    refreshPreview: preview.refetch,
    savingSeries: create.isPending,
  };
}
