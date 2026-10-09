/**
 * "Lặp lại lịch hẹn" on Tạo lịch hẹn (F-65). Every option is counted from the
 * booking's own Ngày hẹn: its weekday for "Hàng tuần", its day of the month
 * for "Hàng tháng".
 */

export const RECURRENCE_PRESETS = ["daily", "weekly", "monthly", "custom"] as const;
export type RecurrencePreset = (typeof RECURRENCE_PRESETS)[number];

/** "Mỗi N [ngày | tuần | tháng]" in Tuỳ chỉnh. */
export const RECURRENCE_UNITS = ["day", "week", "month"] as const;
export type RecurrenceUnit = (typeof RECURRENCE_UNITS)[number];

/** Kết thúc: "Sau số lần" or "Đến ngày". */
export type RecurrenceEndKind = "count" | "until";

/** What the repeat controls hold while the dialog is open. */
export interface RecurrenceValues {
  enabled: boolean;
  preset: RecurrencePreset;
  interval: number;
  unit: RecurrenceUnit;
  /** ISO weekdays, 1 = Monday … 7 = Sunday; the booking's own weekday always counts. */
  weekDays: number[];
  endKind: RecurrenceEndKind;
  count: number;
  /** YYYY-MM-DD; empty until picked. */
  until: string;
}

/** ISO weekday of a YYYY-MM-DD date: 1 = Monday … 7 = Sunday. */
export function isoWeekday(date: string): number {
  return new Date(`${date}T00:00:00`).getDay() || 7;
}

export const MAX_SERIES_SESSIONS = 60;
export const MAX_RECURRENCE_INTERVAL = 99;

export const DEFAULT_RECURRENCE: RecurrenceValues = {
  enabled: false,
  preset: "weekly",
  interval: 1,
  unit: "week",
  weekDays: [],
  endKind: "count",
  count: 6,
  until: "",
};

/** How one row of "Danh sách buổi hẹn" stands. */
export type SeriesSessionState =
  | "free"
  | "conflict"
  | "booked"
  | "timeChanged"
  | "rescheduled"
  | "cancelled"
  | "finished";

/** Why a session reads "Trùng lịch". */
export type SeriesConflictReason = "dentistBusy" | "patientBusy" | "outsideShift" | "dentistOff" | "inThePast";

export interface SeriesSession {
  index: number;
  start: string;
  end: string;
  state: SeriesSessionState;
  conflictReason: SeriesConflictReason | null;
  /** The booked appointment; null on a preview. */
  appointmentId: string | null;
}

export interface AppointmentSeriesView {
  /** Null on a preview. */
  id: string | null;
  sessions: SeriesSession[];
}

/** The rule as the server takes it. */
export interface RecurrenceRequest {
  frequency: number;
  interval: number;
  weekDays: number[];
  end: number;
  count: number | null;
  until: string | null;
}

/** Enough to lay the rule out: who, the first slot and the rule. */
export interface SeriesPreviewRequest {
  patientId: string;
  doctorId: string;
  startTime: string;
  endTime: string;
  recurrence: RecurrenceRequest;
}

/** Where "Lịch đã hẹn" looks after a session row is clicked. */
export interface CalendarFocus {
  start: string;
  end: string;
  /** A preview session — nothing is on the book for it until the series is saved. */
  planned: boolean;
}
