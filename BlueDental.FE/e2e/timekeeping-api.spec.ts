import { expect, test } from "@playwright/test";
import { login, runId } from "./fixtures/auth";
import {
  call,
  clinicToday,
  createRunStaff,
  deleteStaff,
  firstBranchId,
  openDay,
  type RunStaff,
  type TimeKeepingRecord,
} from "./fixtures/timekeepingStaff";

/**
 * Feature: Lịch làm việc / chấm công — the today-only rule the server keeps on
 * its own (BA 2026-10-02): the OFF/ON registration toggle and check-in /
 * check-out are refused on any day but the clinic's today (UTC+7), with no
 * manager override, so admin is refused too.
 *
 * Real HTTP from inside the logged-in page against the real database; see
 * e2e/queue-api.spec.ts for the same pattern.
 */

const BASE = "/api/v1/app/time-keepings";
const NOT_TODAY = "BlueDental:Timekeeping:0012";
const NOT_REGISTERED = 0;
const WORKING = 1;
const MORNING = 1;

function shiftDays(day: string, days: number): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

test.describe("Chấm công — API", () => {
  let branchId: string;
  let staff: RunStaff;

  test.beforeEach(async ({ page }) => {
    await login(page);
    branchId = await firstBranchId(page);
    staff = await createRunStaff(page, branchId, `${runId()}${test.info().workerIndex}`);
  });

  test.afterEach(async ({ page }) => {
    if (staff) await deleteStaff(page, staff.id);
  });

  for (const offset of [-1, 1]) {
    test(`day ${offset > 0 ? "after" : "before"} today: toggle and clock are refused, even for admin`, async ({ page }) => {
      const workDate = shiftDays(clinicToday(), offset);
      // Admin may still open another day (manager override on open-day only).
      const record = await openDay(page, branchId, staff.id, workDate);

      const attempts: [string, unknown][] = [
        ["register-working", undefined],
        ["register-day-off", { reason: null }],
        ["check-in", { shift: MORNING }],
        ["check-out", { shift: MORNING }],
      ];
      for (const [action, json] of attempts) {
        const res = await call(page, `${BASE}/${record.id}/${action}`, { method: "POST", branchId, json });
        expect(res.status, `${action} on ${workDate}`).toBe(403);
        expect(res.body.error?.code, `${action} on ${workDate}`).toBe(NOT_TODAY);
      }

      // Nothing was written: a separate read still sees the untouched record.
      const after = await call<TimeKeepingRecord>(page, `${BASE}/${record.id}`, { branchId });
      expect(after.status).toBe(200);
      expect(after.body.registration).toBe(NOT_REGISTERED);
      expect(after.body.morningShift.checkedInAt).toBeNull();
    });
  }

  test("today: toggle ON, check in and check out all persist", async ({ page }) => {
    const record = await openDay(page, branchId, staff.id, clinicToday());

    for (const [action, json] of [
      ["register-working", undefined],
      ["check-in", { shift: MORNING }],
      ["check-out", { shift: MORNING }],
    ] as const) {
      const res = await call(page, `${BASE}/${record.id}/${action}`, { method: "POST", branchId, json });
      expect(res.status, `${action} (${JSON.stringify(res.body.error)})`).toBe(200);
    }

    const after = await call<TimeKeepingRecord>(page, `${BASE}/${record.id}`, { branchId });
    expect(after.body.registration).toBe(WORKING);
    expect(after.body.morningShift.checkedInAt).not.toBeNull();
    expect(after.body.morningShift.checkedOutAt).not.toBeNull();
  });
});
