import dayjs from "dayjs";

import { LEAVE_SHIFT, type TimeKeepingRecordDto, type WorkShiftDto } from "../api/timekeepingApi";
import type { WorkStatus } from "../components/WorkStatusToggle";

/**
 * "HH:mm:ss" the shift is due to start: its planned start, or the end of a
 * leave that opens it (nghỉ 08:00-10:00 → due at 10:00). Mirrors
 * TimeKeepingRecord.DueStartOf, which freezes the minutes late at check-in.
 */
function dueStartOf(record: TimeKeepingRecordDto, shift: WorkShiftDto, leaveShift: number): string {
  const { leaveStart, leaveEnd } = record;
  const leaveOpensShift =
    record.leaveShift === leaveShift &&
    leaveStart !== null &&
    leaveEnd !== null &&
    leaveStart <= shift.plannedStart &&
    leaveEnd > shift.plannedStart;
  return leaveOpensShift ? leaveEnd : shift.plannedStart;
}

/** When the day's first worked shift is due; a morning taken off whole hands it to the afternoon. */
function firstDueStart(record: TimeKeepingRecordDto): string {
  const morning = record.morningShift;
  const morningDue = dueStartOf(record, morning, LEAVE_SHIFT.Morning);
  return morningDue >= morning.plannedEnd
    ? dueStartOf(record, record.afternoonShift, LEAVE_SHIFT.Afternoon)
    : morningDue;
}

/**
 * ON once a shift is checked in; OFF for a day registered off, or once the
 * first shift is due with no check-in (late check-in turns it ON again);
 * neutral until then (BA 2026-10-14). One rule for past, today and future.
 */
export function resolveWorkStatus(record: TimeKeepingRecordDto, isDayOff: boolean, now: number): WorkStatus {
  if (record.morningShift.checkedInAt || record.afternoonShift.checkedInAt) return "working";
  if (isDayOff) return "dayOff";
  const dueAt = dayjs(`${record.workDate}T${firstDueStart(record)}`);
  return dayjs(now).isBefore(dueAt) ? "notCheckedIn" : "absent";
}
