import type { ReactNode } from "react";
import type { Dayjs } from "dayjs";
import { t } from "@/lib/i18n";
import type { CalendarFocus, RecurrenceValues, SeriesSession } from "../types/appointmentSeries";
import { RecurrenceField } from "./RecurrenceField";
import { RecurrenceSessionList } from "./RecurrenceSessionList";

/** What the booking dialog knows about "Lặp lại lịch hẹn" right now. */
export interface SeriesDialogState {
  recurrence: { values: RecurrenceValues; patch: (change: Partial<RecurrenceValues>) => void };
  active: boolean;
  locked: boolean;
  sessions: SeriesSession[];
  currentAppointmentId: string | null;
  loading: boolean;
  waitingForBooking: boolean;
  errorMessage: string | null;
  range: { from: Dayjs; to: Dayjs } | null;
  focus: CalendarFocus | null;
  selectSession: (session: SeriesSession) => void;
}

interface SeriesSlots {
  field: ReactNode;
  list: ReactNode | null;
  focus: CalendarFocus | null;
  footerLeft: ReactNode;
  /** "Lưu N lịch hẹn" while creating a series; the plain "Lưu" otherwise. */
  saveLabel: string | undefined;
}

/**
 * The dialog's pieces of a series: the field under Giờ hẹn, the session list
 * column, "Từ … đến …" in the footer and the save button's count. A booking
 * edited outside any series gets no field at all — it cannot become one.
 */
export function buildSeriesSlots(series: SeriesDialogState, bookingDate: string, isEdit: boolean): SeriesSlots {
  const field = !isEdit || series.locked ? (
    <RecurrenceField
      values={series.recurrence.values}
      bookingDate={bookingDate}
      locked={series.locked}
      onChange={series.recurrence.patch}
    />
  ) : null;

  const list = series.active ? (
    <RecurrenceSessionList
      sessions={series.sessions}
      loading={series.loading}
      waitingForBooking={series.waitingForBooking}
      errorMessage={series.errorMessage}
      currentAppointmentId={series.currentAppointmentId}
      onSelect={series.selectSession}
    />
  ) : null;

  const footerLeft = series.active && series.range ? (
    <span className="appt-series-range">
      {t("Appointment:Series:Range", series.range.from.format("DD/MM/YYYY"), series.range.to.format("DD/MM/YYYY"))}
    </span>
  ) : undefined;

  const count = series.sessions.length;
  const saveLabel = series.active && !isEdit && count > 0 ? t("Appointment:Series:SaveCount", count) : undefined;

  return { field, list, focus: series.focus, footerLeft, saveLabel };
}
