import { LEAVE_SHIFT, type LeaveShift } from "../api/timekeepingApi";
import { t } from "@/lib/i18n";

/** "HH:mm" on both ends. */
export interface TimeRange {
  start: string;
  end: string;
}

/** The two planned shifts of one staff member on one day. */
export interface ShiftWindows {
  morning: TimeRange;
  afternoon: TimeRange;
}

/** The clinic defaults the backend opens a day with (WorkShift.DefaultMorning/Afternoon). */
export const DEFAULT_SHIFT_WINDOWS: ShiftWindows = {
  morning: { start: "08:00", end: "12:00" },
  afternoon: { start: "13:00", end: "17:00" },
};

export interface LeaveDayDraft {
  /** "YYYY-MM-DD" */
  date: string;
  windows: ShiftWindows;
  shift: LeaveShift | null;
  start: string;
  end: string;
}

export type LeaveDayError = "ShiftRequired" | "EndAfterStart";

export const LEAVE_SHIFT_OPTIONS: readonly LeaveShift[] = [
  LEAVE_SHIFT.Morning,
  LEAVE_SHIFT.Afternoon,
  LEAVE_SHIFT.FullDay,
];

const SHIFT_LABEL_KEY: Record<LeaveShift, string> = {
  [LEAVE_SHIFT.Morning]: "Timekeeping:Leave:Morning",
  [LEAVE_SHIFT.Afternoon]: "Timekeeping:Leave:Afternoon",
  [LEAVE_SHIFT.FullDay]: "Timekeeping:Leave:FullDay",
};

const SHIFT_LONG_LABEL_KEY: Record<LeaveShift, string> = {
  [LEAVE_SHIFT.Morning]: "Timekeeping:Leave:MorningShift",
  [LEAVE_SHIFT.Afternoon]: "Timekeeping:Leave:AfternoonShift",
  [LEAVE_SHIFT.FullDay]: "Timekeeping:Leave:FullDayShift",
};

export const shiftLabel = (shift: LeaveShift): string => t(SHIFT_LABEL_KEY[shift]);
export const shiftLongLabel = (shift: LeaveShift): string => t(SHIFT_LONG_LABEL_KEY[shift]);

/** "08:00:00" or "08:00" → "08:00". */
export const toHourMinute = (time: string): string => time.slice(0, 5);

export function toMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

export function shiftRange(windows: ShiftWindows, shift: LeaveShift): TimeRange {
  if (shift === LEAVE_SHIFT.Morning) return windows.morning;
  if (shift === LEAVE_SHIFT.Afternoon) return windows.afternoon;
  return { start: windows.morning.start, end: windows.afternoon.end };
}

function overlapMinutes(a: TimeRange, b: TimeRange): number {
  const start = Math.max(toMinutes(a.start), toMinutes(b.start));
  const end = Math.min(toMinutes(a.end), toMinutes(b.end));
  return Math.max(0, end - start);
}

/** Time actually taken off: only the part inside a shift counts, so a full day skips the lunch break. */
export function leaveMinutes(day: LeaveDayDraft): number {
  return overlapMinutes(day, day.windows.morning) + overlapMinutes(day, day.windows.afternoon);
}

export function leaveDayError(day: LeaveDayDraft): LeaveDayError | null {
  if (day.shift === null) return "ShiftRequired";
  if (toMinutes(day.end) <= toMinutes(day.start)) return "EndAfterStart";
  return null;
}

export function formatDuration(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return t("Timekeeping:Leave:Minutes", minutes);
  if (minutes === 0) return t("Timekeeping:Leave:Hours", hours);
  return t("Timekeeping:Leave:HoursMinutes", hours, minutes);
}
