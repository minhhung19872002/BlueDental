import { api } from "@/lib/axios";
import type { PagedResult } from "@/types";

/** Matches BlueDental.Timekeeping.WorkRegistration */
export type WorkRegistration = 0 | 1 | 2;
export const WORK_REGISTRATION = {
  NotRegistered: 0,
  Working: 1,
  DayOff: 2,
} as const;

/** Matches BlueDental.Timekeeping.AttendanceStatus */
export type AttendanceStatus = 0 | 1 | 2 | 3 | 4;
export const ATTENDANCE_STATUS = {
  NotStarted: 0,
  Working: 1,
  Completed: 2,
  Abandoned: 3,
  OnLeave: 4,
} as const;

/** Matches BlueDental.Timekeeping.WorkShiftKind */
export type WorkShiftKind = 1 | 2;
export const WORK_SHIFT_KIND = {
  Morning: 1,
  Afternoon: 2,
} as const;

export interface WorkShiftDto {
  kind: WorkShiftKind;
  /** "HH:mm:ss" */
  plannedStart: string;
  plannedEnd: string;
  checkedInAt: string | null;
  checkedOutAt: string | null;
  plannedMinutes: number;
  workedMinutes: number;
  isOpen: boolean;
}

export interface TimeKeepingRecordDto {
  id: string;
  staffId: string;
  clinicBranchId: string;
  /** "YYYY-MM-DD" */
  workDate: string;
  registration: WorkRegistration;
  status: AttendanceStatus;
  morningShift: WorkShiftDto;
  afternoonShift: WorkShiftDto;
  overtimeMinutes: number;
  totalWorkedMinutes: number;
  leaveReason: string | null;
  note: string | null;
  recordedByStaffId: string | null;
  staffName: string | null;
  staffPosition: string | null;
}

export interface TimeKeepingSummaryDto {
  workDate: string;
  totalStaff: number;
  registeredWorking: number;
  registeredDayOff: number;
  currentlyWorking: number;
  abandoned: number;
  totalOvertimeMinutes: number;
}

export interface GetTimeKeepingListInput {
  clinicBranchId?: string;
  staffId?: string;
  fromDate?: string;
  toDate?: string;
  registration?: WorkRegistration;
  status?: AttendanceStatus;
  skipCount?: number;
  maxResultCount?: number;
}

export interface OpenWorkDayInput {
  staffId: string;
  clinicBranchId: string;
  workDate: string;
  morningStart?: string;
  morningEnd?: string;
  afternoonStart?: string;
  afternoonEnd?: string;
}

export interface AttendanceInput {
  shift: WorkShiftKind;
  at?: string;
  recordedByStaffId?: string;
}

const BASE = "/v1/app/time-keepings";

export const timekeepingApi = {
  list: (params: GetTimeKeepingListInput): Promise<PagedResult<TimeKeepingRecordDto>> =>
    api.get<PagedResult<TimeKeepingRecordDto>>(BASE, { params }).then((r) => r.data),

  summary: (clinicBranchId: string, workDate: string): Promise<TimeKeepingSummaryDto> =>
    api
      .get<TimeKeepingSummaryDto>(`${BASE}/summary`, { params: { clinicBranchId, workDate } })
      .then((r) => r.data),

  openWorkDay: (input: OpenWorkDayInput): Promise<TimeKeepingRecordDto> =>
    api.post<TimeKeepingRecordDto>(`${BASE}/open-day`, input).then((r) => r.data),

  registerWorking: (id: string): Promise<TimeKeepingRecordDto> =>
    api.post<TimeKeepingRecordDto>(`${BASE}/${id}/register-working`).then((r) => r.data),

  registerDayOff: (id: string, reason?: string): Promise<TimeKeepingRecordDto> =>
    api.post<TimeKeepingRecordDto>(`${BASE}/${id}/register-day-off`, { reason }).then((r) => r.data),

  checkIn: (id: string, input: AttendanceInput): Promise<TimeKeepingRecordDto> =>
    api.post<TimeKeepingRecordDto>(`${BASE}/${id}/check-in`, input).then((r) => r.data),

  checkOut: (id: string, input: AttendanceInput): Promise<TimeKeepingRecordDto> =>
    api.post<TimeKeepingRecordDto>(`${BASE}/${id}/check-out`, input).then((r) => r.data),
};
