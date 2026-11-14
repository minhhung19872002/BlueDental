import type { WorkScheduleShift } from "../api/workScheduleApi";

export interface ScheduleMemberVm {
  staffId: string;
  fullName: string;
  roleLabel: string;
  isHead: boolean;
  canEdit: boolean;
  initials: string;
  groupKey: string;
  /** Avatar / dot colour slot, shared by the whole group (0-4). */
  colorIndex: number;
  /** Saved days, "YYYY-MM-DD" → shift; a missing day is "Chưa đăng ký". */
  saved: ReadonlyMap<string, WorkScheduleShift>;
}

export interface ScheduleGroupVm {
  /** The unit id, or "none" for "Chưa phân nhóm". */
  key: string;
  /** Null for "Chưa phân nhóm" — the screen names it. */
  name: string | null;
  colorIndex: number;
  members: ScheduleMemberVm[];
}

export interface ScheduleBoardVm {
  year: number;
  month: number;
  /** "YYYY-MM-DD" — locks it and every earlier day. */
  today: string;
  limit: DayOffLimit;
  groups: ScheduleGroupVm[];
}

/** The branch's Lịch nghỉ limit (BA 2026-11-14). */
export interface DayOffLimit {
  /** Most days off per person per calendar month, S/C counting 0.5. */
  max: number;
  /** Admin: not held to it, and the one who sets it. */
  exempt: boolean;
}

/** One day column of the month. */
export interface ScheduleDay {
  /** "YYYY-MM-DD" */
  date: string;
  day: number;
  /** 0 = Sunday … 6 = Saturday. */
  dow: number;
  isWeekend: boolean;
  isToday: boolean;
  /** Today or earlier: read-only. */
  locked: boolean;
}

/** An unsaved change, kept across months until "Lưu lịch" or "Đặt lại". */
export interface PendingChange {
  staffId: string;
  staffName: string;
  date: string;
  from: WorkScheduleShift;
  to: WorkScheduleShift;
}

export type ScheduleView = "team" | "person";
