import type { Page } from "@playwright/test";
import { call } from "./timekeepingStaff";

/**
 * A booking outside the dentist's shifts that day is refused (R-742): the
 * defaults are 08:00-12:00 and 13:00-17:00 on the clinic's clock (UTC+7).
 *
 * A spec that books "now + N minutes" runs at lunch or in the evening as
 * often as not, so it first gives the dentist a shift covering that time —
 * through the real Lịch làm việc API, as a manager would open an evening
 * shift. Times inside the defaults are left alone, so the timekeeping data of
 * other specs is not touched for nothing.
 */

const CLINIC_OFFSET_MS = 7 * 3_600_000;
const DAY_OFF = 2;
const DEFAULT_SHIFTS: readonly (readonly [string, string])[] = [
  ["08:00", "12:00"],
  ["13:00", "17:00"],
];
const WHOLE_DAY = {
  morningStart: "00:00:00",
  morningEnd: "12:00:00",
  afternoonStart: "12:00:00",
  afternoonEnd: "23:59:00",
};

interface ShiftRecord {
  id: string;
  registration: number;
  note: string | null;
  leaveStart: string | null;
  morningShift: { plannedStart: string; plannedEnd: string };
  afternoonShift: { plannedStart: string; plannedEnd: string };
}

/** The clinic day ("YYYY-MM-DD") and wall-clock time ("HH:mm") of an instant. */
function clinicClock(at: Date): { day: string; time: string } {
  const iso = new Date(at.getTime() + CLINIC_OFFSET_MS).toISOString();
  return { day: iso.slice(0, 10), time: iso.slice(11, 16) };
}

function fitsOne(windows: readonly (readonly [string, string])[], start: Date, end: Date): boolean {
  const from = clinicClock(start);
  const to = clinicClock(end);
  return from.day === to.day && windows.some(([open, close]) => open <= from.time && to.time <= close);
}

/** Whether the record's shifts, joined where they touch, hold [start, end). */
function covers(record: ShiftRecord, start: Date, end: Date): boolean {
  if (record.registration === DAY_OFF || record.leaveStart) return false;
  const morning = [record.morningShift.plannedStart.slice(0, 5), record.morningShift.plannedEnd.slice(0, 5)] as const;
  const afternoon = [record.afternoonShift.plannedStart.slice(0, 5), record.afternoonShift.plannedEnd.slice(0, 5)] as const;
  const windows = morning[1] >= afternoon[0] ? [[morning[0], afternoon[1]] as const] : [morning, afternoon];
  return fitsOne(windows, start, end);
}

/**
 * Makes sure `dentistId` works through [start, end) at the branch. Resolves
 * false when that cannot be arranged (a day off, a leave, attendance already
 * clocked on other hours), so the caller tries another dentist.
 */
export async function openShiftCovering(
  page: Page,
  branchId: string,
  dentistId: string,
  start: Date,
  end: Date,
): Promise<boolean> {
  if (fitsOne(DEFAULT_SHIFTS, start, end)) return true;

  const workDate = clinicClock(start).day;
  // Returns the day's record as it is when one is already open.
  const opened = await call<ShiftRecord>(page, "/api/v1/app/time-keepings/open-day", {
    method: "POST",
    branchId,
    json: { staffId: dentistId, clinicBranchId: branchId, workDate, ...WHOLE_DAY },
  });
  if (opened.status !== 200) return false;
  if (covers(opened.body, start, end)) return true;

  // Rescheduling is ignored once someone clocked in; `covers` then says so.
  const widened = await call<ShiftRecord>(page, `/api/v1/app/time-keepings/${opened.body.id}/info`, {
    method: "PUT",
    branchId,
    json: { note: opened.body.note, ...WHOLE_DAY },
  });
  return widened.status === 200 && covers(widened.body, start, end);
}
