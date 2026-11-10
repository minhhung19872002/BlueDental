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
  groups: ScheduleGroupVm[];
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
