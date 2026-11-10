import dayjs from "dayjs";
import { WORK_SCHEDULE_SHIFT, type WorkScheduleShift } from "../api/workScheduleApi";
import type { PendingChange, ScheduleDay } from "../types/workSchedule";

/** The three shifts a brush paints, in brush-bar order. */
export const BRUSH_SHIFTS = [
  WORK_SCHEDULE_SHIFT.Morning,
  WORK_SCHEDULE_SHIFT.Afternoon,
  WORK_SCHEDULE_SHIFT.FullDay,
] as const;

export type BrushShift = (typeof BRUSH_SHIFTS)[number];

/** Short code in a cell, and the CSS modifier that colours it. */
export const SHIFT_CODE: Record<WorkScheduleShift, { short: string; css: string }> = {
  [WORK_SCHEDULE_SHIFT.None]: { short: "", css: "e" },
  [WORK_SCHEDULE_SHIFT.Morning]: { short: "S", css: "s" },
  [WORK_SCHEDULE_SHIFT.Afternoon]: { short: "C", css: "c" },
  [WORK_SCHEDULE_SHIFT.FullDay]: { short: "SC", css: "f" },
};

/** i18n key of each shift's long name. */
export const SHIFT_LABEL_KEY: Record<WorkScheduleShift, string> = {
  [WORK_SCHEDULE_SHIFT.None]: "Timekeeping:Board:Shift:None",
  [WORK_SCHEDULE_SHIFT.Morning]: "Timekeeping:Board:Shift:Morning",
  [WORK_SCHEDULE_SHIFT.Afternoon]: "Timekeeping:Board:Shift:Afternoon",
  [WORK_SCHEDULE_SHIFT.FullDay]: "Timekeeping:Board:Shift:FullDay",
};

/** Công: a full day counts 1, a half day 0.5. */
export function workUnits(shift: WorkScheduleShift): number {
  if (shift === WORK_SCHEDULE_SHIFT.FullDay) return 1;
  return shift === WORK_SCHEDULE_SHIFT.None ? 0 : 0.5;
}

export const worksMorning = (shift: WorkScheduleShift) =>
  shift === WORK_SCHEDULE_SHIFT.Morning || shift === WORK_SCHEDULE_SHIFT.FullDay;

export const worksAfternoon = (shift: WorkScheduleShift) =>
  shift === WORK_SCHEDULE_SHIFT.Afternoon || shift === WORK_SCHEDULE_SHIFT.FullDay;

/** "1,5" — Vietnamese decimal comma, whole numbers bare. */
export function formatUnits(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(".", ",");
}

/** Every day of `month` (1-12); `today` locks itself and the days before it. */
export function monthDays(year: number, month: number, today: string): ScheduleDay[] {
  const first = dayjs(new Date(year, month - 1, 1));
  return Array.from({ length: first.daysInMonth() }, (_, i) => {
    const d = first.add(i, "day");
    const date = d.format("YYYY-MM-DD");
    const dow = d.day();
    return {
      date,
      day: i + 1,
      dow,
      isWeekend: dow === 0 || dow === 6,
      isToday: date === today,
      locked: date <= today,
    };
  });
}

export const pendingKey = (staffId: string, date: string) => `${staffId}|${date}`;

export type ChangeKind = "new" | "edit" | "cancel";

export function changeKind(change: PendingChange): ChangeKind {
  if (change.to === WORK_SCHEDULE_SHIFT.None) return "cancel";
  return change.from === WORK_SCHEDULE_SHIFT.None ? "new" : "edit";
}
