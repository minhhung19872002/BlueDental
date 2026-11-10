import { api } from "@/lib/axios";

const BASE = "/v1/app/work-schedules";

/** Mirrors BlueDental.Timekeeping.WorkScheduleShift — S / C / SC on the board. */
export const WORK_SCHEDULE_SHIFT = { None: 0, Morning: 1, Afternoon: 2, FullDay: 3 } as const;
export type WorkScheduleShift = (typeof WORK_SCHEDULE_SHIFT)[keyof typeof WORK_SCHEDULE_SHIFT];

/** Mirrors BlueDental.Staff.OrgUnitKind. */
export type WorkScheduleUnitKind = 1 | 2 | 3;

export interface WorkScheduleDayDto {
  /** "YYYY-MM-DD" */
  workDate: string;
  shift: WorkScheduleShift;
}

export interface WorkScheduleMemberDto {
  staffId: string;
  fullName: string;
  roleLabel: string | null;
  isDentist: boolean;
  isHead: boolean;
  avatarUrl: string | null;
  /** Whether the caller may change this person's coming days. */
  canEdit: boolean;
  /** Registered days only; a missing day is "Chưa đăng ký". */
  days: WorkScheduleDayDto[];
}

export interface WorkScheduleGroupDto {
  /** Null for "Chưa phân nhóm". */
  unitId: string | null;
  name: string | null;
  kind: WorkScheduleUnitKind | null;
  headStaffId: string | null;
  members: WorkScheduleMemberDto[];
}

export interface WorkScheduleBoardDto {
  year: number;
  month: number;
  /** "YYYY-MM-DD" — the clinic's today; it and every earlier day are locked. */
  today: string;
  groups: WorkScheduleGroupDto[];
}

export interface WorkScheduleItemInput {
  staffId: string;
  workDate: string;
  shift: WorkScheduleShift;
}

export interface SaveWorkScheduleResultDto {
  saved: number;
  logged: number;
}

export const workScheduleApi = {
  board: (year: number, month: number) =>
    api.get<WorkScheduleBoardDto>(BASE, { params: { year, month } }).then((r) => r.data),

  save: (items: WorkScheduleItemInput[]) =>
    api.post<SaveWorkScheduleResultDto>(`${BASE}/save`, { items }).then((r) => r.data),
};
