import { expect, test, type BrowserContext, type Locator, type Page } from "@playwright/test";
import { login, runId } from "./fixtures/auth";
import {
  call,
  clinicToday,
  createRunStaff,
  deleteStaff,
  firstBranchId,
  openDay,
  RUN_STAFF_PASSWORD,
  type RunStaff,
  type TimeKeepingRecord,
} from "./fixtures/timekeepingStaff";

/**
 * Feature: Lịch làm việc grid (BA 2026-10-02). A staff member may only mark or
 * clear their own day off (X) on a day that has not passed and has not been
 * clocked in; V / L cells and other people's rows are locked for every role,
 * admin included, and the workSchedule "Sửa" grant is still required.
 *
 * Each run creates two throw-away staff: `me` (seeded `admin` role, so it holds
 * every grant) signs in through the real login screen in its own context to
 * act on its own row, and `other` is the row nobody but its owner may touch.
 * Real HTTP from inside the logged-in pages against the real database.
 */

const BASE = "/api/v1/app/time-keepings";
const BULK = `${BASE}/bulk-register`;
const CELL_LOCKED = "BlueDental:Timekeeping:0013";
const NOT_REGISTERED = 0;
const WORKING = 1;
const DAY_OFF = 2;
const MORNING = 1;

function shiftDays(day: string, days: number): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

async function readCell(page: Page, branchId: string, staffId: string, workDate: string) {
  const query = `clinicBranchId=${branchId}&staffId=${staffId}&fromDate=${workDate}&toDate=${workDate}`;
  const res = await call<{ items: TimeKeepingRecord[] }>(page, `${BASE}?${query}`, { branchId });
  expect(res.status, "read the cell back").toBe(200);
  return res.body.items[0];
}

async function bulkRegister(page: Page, branchId: string, items: unknown[]) {
  return call(page, BULK, { method: "POST", branchId, json: { items } });
}

/** Opens and clocks `staffId` in on today's morning shift, as the admin. */
async function clockInToday(page: Page, branchId: string, staffId: string) {
  const record = await openDay(page, branchId, staffId, clinicToday());
  for (const [action, json] of [
    ["register-working", undefined],
    ["check-in", { shift: MORNING }],
  ] as const) {
    const res = await call(page, `${BASE}/${record.id}/${action}`, { method: "POST", branchId, json });
    expect(res.status, `${action} (${JSON.stringify(res.body.error)})`).toBe(200);
  }
  return record;
}

test.describe("Lịch làm việc — chỉ đánh X của chính mình", () => {
  let branchId: string;
  let me: RunStaff;
  let other: RunStaff;
  let meContext: BrowserContext | undefined;
  let mePage: Page;

  test.beforeEach(async ({ page, browser }) => {
    await login(page);
    branchId = await firstBranchId(page);
    const run = `${runId()}${test.info().workerIndex}`;
    me = await createRunStaff(page, branchId, `me${run}`, { roleNames: ["admin"] });
    other = await createRunStaff(page, branchId, `ot${run}`);

    meContext = await browser.newContext();
    mePage = await meContext.newPage();
    await login(mePage, { userName: `tk-e2e-me${run}`, password: RUN_STAFF_PASSWORD });
  });

  test.afterEach(async ({ page }) => {
    await meContext?.close();
    if (me) await deleteStaff(page, me.id);
    if (other) await deleteStaff(page, other.id);
  });

  test("API: another staff's row is refused, admin included, and nothing is written", async ({ page }) => {
    const tomorrow = shiftDays(clinicToday(), 1);
    const l = await clockInToday(page, branchId, other.id);

    for (const [who, actor] of [["admin", page], ["me", mePage]] as const) {
      for (const item of [
        { staffId: other.id, workDate: tomorrow, registration: DAY_OFF },
        { staffId: other.id, workDate: clinicToday(), registration: NOT_REGISTERED },
      ]) {
        const res = await bulkRegister(actor, branchId, [item]);
        expect(res.status, `${who} → ${item.workDate}`).toBe(403);
        expect(res.body.error?.code, `${who} → ${item.workDate}`).toBe(CELL_LOCKED);
      }
    }

    // Separate reads: today's L and its check-in survive, tomorrow stays empty.
    const today = await readCell(page, branchId, other.id, clinicToday());
    expect(today.id).toBe(l.id);
    expect(today.registration).toBe(WORKING);
    expect(today.morningShift.checkedInAt).not.toBeNull();
    expect(await readCell(page, branchId, other.id, tomorrow)).toBeUndefined();
  });

  test("API: own row — X on a later day persists and clears, V / L / past are refused", async ({ page }) => {
    const tomorrow = shiftDays(clinicToday(), 1);
    const later = shiftDays(clinicToday(), 2);

    const mark = await bulkRegister(mePage, branchId, [{ staffId: me.id, workDate: tomorrow, registration: DAY_OFF }]);
    expect(mark.status, JSON.stringify(mark.body.error)).toBe(200);
    expect((await readCell(page, branchId, me.id, tomorrow)).registration).toBe(DAY_OFF);

    const clear = await bulkRegister(mePage, branchId, [
      { staffId: me.id, workDate: tomorrow, registration: NOT_REGISTERED },
    ]);
    expect(clear.status, JSON.stringify(clear.body.error)).toBe(200);
    expect((await readCell(page, branchId, me.id, tomorrow)).registration).toBe(NOT_REGISTERED);

    const refused: [string, unknown[]][] = [
      ["past day", [{ staffId: me.id, workDate: shiftDays(clinicToday(), -1), registration: DAY_OFF }]],
      ["marking L", [{ staffId: me.id, workDate: later, registration: WORKING }]],
      // One locked cell refuses the whole batch, the valid cell included.
      ["mixed batch", [
        { staffId: me.id, workDate: later, registration: DAY_OFF },
        { staffId: other.id, workDate: later, registration: DAY_OFF },
      ]],
    ];
    for (const [label, items] of refused) {
      const res = await bulkRegister(mePage, branchId, items);
      expect(res.status, label).toBe(403);
      expect(res.body.error?.code, label).toBe(CELL_LOCKED);
    }
    expect(await readCell(page, branchId, me.id, later)).toBeUndefined();

    // Today once clocked in is L: neither X nor a reset may touch it.
    await clockInToday(page, branchId, me.id);
    for (const registration of [DAY_OFF, NOT_REGISTERED]) {
      const res = await bulkRegister(mePage, branchId, [{ staffId: me.id, workDate: clinicToday(), registration }]);
      expect(res.status, `today → ${registration}`).toBe(403);
      expect(res.body.error?.code).toBe(CELL_LOCKED);
    }
    const today = await readCell(page, branchId, me.id, clinicToday());
    expect(today.registration).toBe(WORKING);
    expect(today.morningShift.checkedInAt).not.toBeNull();
  });

  test("UI: only my own empty cells click to X, the X survives a reload", async ({ page }) => {
    const today = clinicToday();
    const tomorrow = shiftDays(today, 1);
    await clockInToday(page, branchId, me.id);

    const cell = (row: Locator, day: string) =>
      row.locator("td.wsb-td-day").nth(Number(day.slice(8)) - 1).getByRole("button");
    const rowOf = (staff: RunStaff) => mePage.getByRole("row").filter({ hasText: staff.fullName });
    const openBuilder = async (day: string) => {
      await mePage.goto(`/calendar?tab=timekeeping&workSchedule=builder&date=${day}`);
      await expect(rowOf(me)).toBeVisible();
    };

    // Today's L on my own row is locked; another row is locked end to end.
    await openBuilder(today);
    await expect(cell(rowOf(me), today)).toHaveText("L");
    await expect(cell(rowOf(me), today)).toBeDisabled();
    await expect(rowOf(other).locator("td.wsb-td-day button:enabled")).toHaveCount(0);
    await expect(rowOf(other).getByRole("checkbox")).toBeDisabled();

    await openBuilder(tomorrow);
    const mine = cell(rowOf(me), tomorrow);
    await expect(mine).toBeEnabled();
    await expect(mine).toHaveText("");
    await expect(cell(rowOf(other), tomorrow)).toBeDisabled();

    const save = async () => {
      await mePage.getByRole("button", { name: "Lưu thay đổi" }).click();
      await mePage.getByRole("button", { name: "Xác nhận lưu" }).click();
      await expect(mePage.getByText("Đã lưu lịch làm việc cho 1 ô.")).toBeVisible();
    };

    await mine.click();
    await expect(mine).toHaveText("X");
    await save();
    await mePage.reload();
    await expect(cell(rowOf(me), tomorrow)).toHaveText("X");
    expect((await readCell(page, branchId, me.id, tomorrow)).registration).toBe(DAY_OFF);

    // The day board for that day follows the grid: my card reads OFF ("Nghỉ"),
    // not the neutral "not come yet" slot, and the other card stays neutral.
    const cardOf = (staff: RunStaff) => mePage.locator(".tk-card").filter({ hasText: staff.fullName });
    await mePage.goto(`/calendar?tab=timekeeping&date=${tomorrow}`);
    await expect(cardOf(me).getByRole("img", { name: "Nghỉ" })).toHaveClass(/tk-toggle--off/);
    await expect(cardOf(other).getByRole("img", { name: "Không điểm danh" })).toBeVisible();

    // Clicking my saved X clears it again.
    await openBuilder(tomorrow);
    await cell(rowOf(me), tomorrow).click();
    await expect(cell(rowOf(me), tomorrow)).toHaveText("");
    await save();
    await mePage.reload();
    await expect(cell(rowOf(me), tomorrow)).toHaveText("");
    expect((await readCell(page, branchId, me.id, tomorrow)).registration).toBe(NOT_REGISTERED);
  });
});
