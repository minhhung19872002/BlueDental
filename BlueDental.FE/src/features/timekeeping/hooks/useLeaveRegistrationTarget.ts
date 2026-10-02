import { useCallback, useMemo, useState } from "react";

import type { StaffDto } from "@/features/staff/api/staffApi";
import type { TimeKeepingRecordDto } from "../api/timekeepingApi";
import { DEFAULT_SHIFT_WINDOWS, toHourMinute, type ShiftWindows, type TimeRange } from "../utils/leaveShifts";

interface Options {
  staff: StaffDto[] | undefined;
  records: TimeKeepingRecordDto[] | undefined;
  today: string;
  currentUserId: string | undefined;
  canUpdate: boolean;
}

export interface LeaveDayInfo {
  windows: ShiftWindows;
  /** Past, or already clocked in — nothing left to take off. */
  locked: boolean;
}

function profileRange(start: string | null, end: string | null, fallback: TimeRange): TimeRange {
  if (!start || !end || start >= end) return fallback;
  return { start: toHourMinute(start), end: toHourMinute(end) };
}

/** The staff member's own hours from Nhân viên — what the server opens a new day with. */
function profileWindows(staff: StaffDto): ShiftWindows {
  return {
    morning: profileRange(staff.morningStartTime, staff.morningEndTime, DEFAULT_SHIFT_WINDOWS.morning),
    afternoon: profileRange(staff.afternoonStartTime, staff.afternoonEndTime, DEFAULT_SHIFT_WINDOWS.afternoon),
  };
}

function recordWindows(record: TimeKeepingRecordDto): ShiftWindows {
  return {
    morning: { start: toHourMinute(record.morningShift.plannedStart), end: toHourMinute(record.morningShift.plannedEnd) },
    afternoon: { start: toHourMinute(record.afternoonShift.plannedStart), end: toHourMinute(record.afternoonShift.plannedEnd) },
  };
}

/**
 * Whose "Đăng ký nghỉ" dialog is open. Like the X cells, leave can only be
 * registered on one's own row, by every role (BA 2026-10-02); the server
 * enforces the same.
 */
export function useLeaveRegistrationTarget({ staff, records, today, currentUserId, canUpdate }: Options) {
  const [staffId, setStaffId] = useState<string | null>(null);

  const target = useMemo(() => staff?.find((s) => s.id === staffId) ?? null, [staff, staffId]);

  const canRegisterLeave = useCallback(
    (id: string) => canUpdate && id === currentUserId,
    [canUpdate, currentUserId],
  );

  const getDayInfo = useCallback(
    (dateStr: string): LeaveDayInfo => {
      const record = records?.find((r) => r.staffId === target?.id && r.workDate === dateStr);
      const clockedIn = !!(record?.morningShift?.checkedInAt || record?.afternoonShift?.checkedInAt);
      return {
        windows: record ? recordWindows(record) : target ? profileWindows(target) : DEFAULT_SHIFT_WINDOWS,
        locked: dateStr < today || clockedIn,
      };
    },
    [records, target, today],
  );

  const open = useCallback((id: string) => setStaffId(id), []);
  const close = useCallback(() => setStaffId(null), []);

  return { target, canRegisterLeave, getDayInfo, open, close };
}
