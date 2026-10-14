import { expect, test, type Page } from "@playwright/test";
import { assertRealApiTraffic, login, runId } from "./fixtures/auth";
import { createRunStaff, deleteStaff, firstBranchId } from "./fixtures/timekeepingStaff";

/** Profile hours whose morning shift is due from the clinic's midnight on. */
const SHIFT_DUE_SINCE_MIDNIGHT = {
  morningStartTime: "00:00",
  morningEndTime: "23:50",
  afternoonStartTime: "23:51",
  afternoonEndTime: "23:59",
};

/** Profile hours whose first shift is not due until 23:56. */
const SHIFT_DUE_AT_MIDNIGHT_EVE = {
  morningStartTime: "23:56",
  morningEndTime: "23:57",
  afternoonStartTime: "23:58",
  afternoonEndTime: "23:59",
};

/** Narrows today's board to the run staff member's card. */
async function findRunCard(page: Page, run: string) {
  await page.locator(".floating-field", { hasText: "Tìm kiếm" }).getByRole("textbox").fill(run);
  const card = page.locator(".tk-card", { hasText: run });
  await expect(card).toHaveCount(1);
  return card;
}

/** Minutes since the browser's midnight — the clock the board compares shift times on. */
function localMinuteOfDay(): number {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

/** A future date that no earlier run has used, so the board starts empty. */
/**
 * Attendance is one record per staff per day, so a run that reuses a day another
 * run already opened finds it half clocked. The window is wide enough that two
 * runs practically never land on the same day.
 */
function freshWorkDate(): string {
  const date = new Date();
  date.setDate(date.getDate() + 30 + Math.floor(Math.random() * 5000));
  return date.toISOString().slice(0, 10);
}

/**
 * Feature: Lịch làm việc / chấm công.
 */
test.describe("Chấm công", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("the work schedule board loads its KPIs from the real API", async ({ page }) => {
    await page.goto("/calendar?tab=timekeeping");
    await assertRealApiTraffic(page, "/api/v1/app/time-keepings/summary");

    // Scoped to the KPI row: "Đang làm việc" is also the tag on every staff
    // card, so an unscoped lookup is ambiguous as soon as the roster is real.
    const kpis = page.locator(".tk-stat-chips");

    for (const label of [
      "Tổng CBNV",
      "Đăng kí làm",
      "Đăng kí nghỉ",
      "Đang làm việc",
      "Nghỉ ngang",
      "Giờ tăng ca",
    ]) {
      await expect(kpis.getByText(label, { exact: true })).toBeVisible();
    }
  });

  test("the tab lives in the URL so it survives a reload", async ({ page }) => {
    await page.goto("/calendar");
    await page.getByRole("tab", { name: "Lịch làm việc" }).click();

    await expect(page).toHaveURL(/tab=timekeeping/);

    await page.reload();
    await expect(page.getByRole("tab", { name: "Lịch làm việc" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  test("OFF/ON is a read-only status, and check-in is only offered on the current day", async ({ page }) => {
    // BA 2026-10-02: nobody flips OFF/ON by hand, and no manager override —
    // even admin cannot clock any day other than today.
    await page.goto(`/calendar?tab=timekeeping&date=${freshWorkDate()}`);
    await assertRealApiTraffic(page, "/api/v1/app/time-keepings/summary");

    const checkIns = page.getByRole("button", { name: "Vào ca", exact: true });
    await expect(checkIns.first()).toBeVisible();
    for (const button of await checkIns.all()) {
      await expect(button).toBeDisabled();
    }
    // A day still to come is neither ON nor OFF yet.
    await expect(page.getByRole("img", { name: "Không điểm danh", exact: true }).first()).toBeVisible();
    await expect(page.getByRole("img", { name: "Vắng", exact: true })).toHaveCount(0);
    for (const name of ["Làm việc hôm nay", "Nghỉ hôm nay", "Chưa chọn"]) {
      await expect(page.getByRole("button", { name, exact: true })).toHaveCount(0);
    }
  });

  test("today: checking in on the progress bar turns the card ON, and it survives a reload", async ({ page }) => {
    const branchId = await firstBranchId(page);
    const run = `${runId()}${test.info().workerIndex}`;
    // The morning shift opened at midnight, so it is already due whenever this runs.
    const staff = await createRunStaff(page, branchId, run, { ...SHIFT_DUE_SINCE_MIDNIGHT });
    try {
      await page.goto(`/calendar?tab=timekeeping&branchId=${branchId}`);
      await assertRealApiTraffic(page, "/api/v1/app/time-keepings/summary");

      const findCard = () => findRunCard(page, run);

      let card = await findCard();
      // Today, the shift due and no check-in: OFF ("Vắng") (BA 2026-10-14).
      await expect(card.getByRole("img", { name: "Vắng", exact: true })).toBeVisible();

      // No record yet (a virtual card): the first check-in opens the day, then
      // clocks in, and the board refetches the real record.
      await Promise.all([
        page.waitForResponse((r) => r.url().includes("/open-day") && r.status() === 200),
        page.waitForResponse((r) => r.url().includes("/check-in") && r.status() === 200),
        card.getByRole("button", { name: "Vào ca", exact: true }).click(),
      ]);
      await expect(card.getByRole("img", { name: "Làm việc", exact: true })).toBeVisible();

      const checkOut = card.getByRole("button", { name: "Ca sáng", exact: true });
      await expect(checkOut).toBeEnabled();
      await Promise.all([
        page.waitForResponse((r) => r.url().includes("/check-out") && r.status() === 200),
        checkOut.click(),
      ]);

      await page.reload();
      card = await findCard();
      // Morning done and stamped: both steps are spent, the afternoon is next,
      // and the card still reads ON.
      await expect(card.getByRole("img", { name: "Làm việc", exact: true })).toBeVisible();
      await expect(card.getByRole("button", { name: "Vào ca", exact: true })).toBeDisabled();
      await expect(card.getByRole("button", { name: "Ca sáng", exact: true })).toBeDisabled();
      await expect(card.getByRole("button", { name: "Vào ca chiều", exact: true })).toBeEnabled();
      await expect(card.locator(".tk-timeline-time--visible")).toHaveCount(2);
    } finally {
      await deleteStaff(page, staff.id);
    }
  });

  test("today: a shift not yet due stays neutral, not OFF", async ({ page }) => {
    test.skip(localMinuteOfDay() >= 23 * 60 + 55, "the shift below starts at 23:56");
    const branchId = await firstBranchId(page);
    const run = `${runId()}${test.info().workerIndex}n`;
    const staff = await createRunStaff(page, branchId, run, { ...SHIFT_DUE_AT_MIDNIGHT_EVE });
    try {
      await page.goto(`/calendar?tab=timekeeping&branchId=${branchId}`);
      await assertRealApiTraffic(page, "/api/v1/app/time-keepings/summary");

      // BA 2026-10-14: no OFF before the shift is due (no grace period after).
      const card = await findRunCard(page, run);
      await expect(card.getByRole("img", { name: "Không điểm danh", exact: true })).toBeVisible();
      await expect(card.getByRole("img", { name: "Vắng", exact: true })).toHaveCount(0);
    } finally {
      await deleteStaff(page, staff.id);
    }
  });
});
