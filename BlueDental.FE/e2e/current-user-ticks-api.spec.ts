import { expect, test } from "@playwright/test";
import { login, runId } from "./fixtures/auth";
import {
  call,
  createRunStaff,
  deleteStaff,
  firstBranchId,
  RUN_STAFF_PASSWORD,
  type RunStaff,
} from "./fixtures/timekeepingStaff";

/**
 * Feature: `GET /account/current-user` carries the "Bác sĩ", "Phụ tá" and
 * "Y sĩ" ticks of the staff form (BA 2026-10-05). Tiếp nhận and Lịch hẹn read
 * them to pick the record tab a patient's name opens, so they must reach an
 * account that holds no permission at all — such an account is refused its
 * own `/staff/{id}`.
 *
 * Real HTTP from logged-in pages against the real database.
 */

interface Ticks {
  isDentist: boolean;
  isAssistant: boolean;
  isHygienist: boolean;
}

const CASES: { who: string; ticks: Ticks }[] = [
  { who: "Bác sĩ", ticks: { isDentist: true, isAssistant: false, isHygienist: false } },
  { who: "Phụ tá", ticks: { isDentist: false, isAssistant: true, isHygienist: false } },
  { who: "Y sĩ", ticks: { isDentist: false, isAssistant: false, isHygienist: true } },
  { who: "no tick", ticks: { isDentist: false, isAssistant: false, isHygienist: false } },
];

test.describe("current-user — staff ticks", () => {
  let created: RunStaff | undefined;

  test.afterEach(async ({ page }) => {
    if (created) await deleteStaff(page, created.id);
    created = undefined;
  });

  CASES.forEach(({ who, ticks }, i) => {
    test(`${who}: the ticks reach an account with no permission`, async ({ page, browser }) => {
      await login(page);
      const branchId = await firstBranchId(page);
      const run = `tick${runId()}${i}`;
      created = await createRunStaff(page, branchId, run, { ...ticks, roleNames: [] });

      const context = await browser.newContext();
      try {
        const own = await context.newPage();
        await login(own, { userName: `tk-e2e-${run}`, password: RUN_STAFF_PASSWORD });

        const me = await call<Ticks & { id: string }>(own, "/api/v1/app/account/current-user");
        expect(me.status).toBe(200);
        expect(me.body.id).toBe(created.id);
        expect({
          isDentist: me.body.isDentist,
          isAssistant: me.body.isAssistant,
          isHygienist: me.body.isHygienist,
        }).toEqual(ticks);

        // The staff record itself is out of reach without "Nhân viên – xem".
        const staff = await call(own, `/api/v1/app/staff/${created.id}`);
        expect(staff.status).toBe(403);
      } finally {
        await context.close();
      }
    });
  });
});
