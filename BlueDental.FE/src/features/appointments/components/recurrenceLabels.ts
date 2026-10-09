import dayjs from "dayjs";
import { t } from "@/lib/i18n";
import {
  isoWeekday,
  type RecurrencePreset,
  type RecurrenceUnit,
  type SeriesConflictReason,
  type SeriesSessionState,
} from "../types/appointmentSeries";

/** T2 … CN, Monday first, as ISO weekdays. */
export const ISO_WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const;

export const STATE_LABEL_KEY: Record<SeriesSessionState, string> = {
  free: "Appointment:Series:State:Free",
  conflict: "Appointment:Series:State:Conflict",
  booked: "Appointment:Series:State:Booked",
  timeChanged: "Appointment:Series:State:TimeChanged",
  rescheduled: "Appointment:Series:State:Rescheduled",
  cancelled: "Appointment:Series:State:Cancelled",
  finished: "Appointment:Series:State:Finished",
};

export const REASON_LABEL_KEY: Record<SeriesConflictReason, string> = {
  dentistBusy: "Appointment:Series:Reason:DentistBusy",
  patientBusy: "Appointment:Series:Reason:PatientBusy",
  outsideShift: "Appointment:Series:Reason:OutsideShift",
  dentistOff: "Appointment:Series:Reason:DentistOff",
  inThePast: "Appointment:Series:Reason:InThePast",
};

export const UNIT_LABEL_KEY: Record<RecurrenceUnit, string> = {
  day: "Appointment:Series:Unit:Day",
  week: "Appointment:Series:Unit:Week",
  month: "Appointment:Series:Unit:Month",
};

export function weekdayShort(iso: number): string {
  return t(`Appointment:Series:WeekdayShort:${iso}`);
}

/** "T5, 08/10/2026". */
export function sessionDayLabel(start: string): string {
  const day = dayjs(start);
  return `${weekdayShort(isoWeekday(day.format("YYYY-MM-DD")))}, ${day.format("DD/MM/YYYY")}`;
}

const PRESET_LABEL: Record<RecurrencePreset, (bookingDate: string) => string> = {
  daily: () => t("Appointment:Series:Preset:Daily"),
  weekly: (date) => t("Appointment:Series:Preset:Weekly", t(`Appointment:Series:WeekdayLong:${isoWeekday(date)}`)),
  monthly: (date) => t("Appointment:Series:Preset:Monthly", dayjs(date).date()),
  custom: () => t("Appointment:Series:Preset:Custom"),
};

/** The dropdown's wording, read off the booking's own Ngày hẹn. */
export function presetLabel(preset: RecurrencePreset, bookingDate: string): string {
  return PRESET_LABEL[preset](bookingDate || dayjs().format("YYYY-MM-DD"));
}
