import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { assertRealApiTraffic, login, runId } from "./fixtures/auth";
import {
  call,
  createRunStaff,
  deleteStaff,
  firstBranchId,
  RUN_STAFF_PASSWORD,
  type RunStaff,
} from "./fixtures/timekeepingStaff";

/**
 * Feature: Lịch làm việc → "Đăng ký nghỉ" — the calendar button on one's own
 * row opens a dialog for several days off, each with its own shift and hours.
 * Like the X cells (BA 2026-10-02) it works on one's own row only.
 *
 * Each run creates two throw-away staff: `me` (seeded `admin` role) signs in
 * through the real login screen, `other` is a row `me` may not touch. Real
 * stack: no interception, the save lands in PostgreSQL and is read back.
 */

const REGISTER_LEAVE = "/api/v1/app/time-keepings/register-leave";
const CELL_LOCKED = "BlueDental:Timekeeping:0013";

/** Next month, so every day in it can still be taken off. */
function nextMonth() {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + 1);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return { iso: (day: number) => `${year}-${mm}-${String(day).padStart(2, "0")}`, label: (day: number) => `${String(day).padStart(2, "0")}/${mm}/${year}` };
}

function dayCell(page: Page, staffName: string, day: number) {
  return page
    .locator("tr", { has: page.getByText(staffName, { exact: true }) })
    .locator("td.wsb-td-day")
    .nth(day - 1)
    .getByRole("button");
}

const leaveButton = (page: Page, staffName: string) =>
  page.getByRole("button", { name: `Đăng ký nghỉ nhiều ngày cho ${staffName}`, exact: true });

test.describe("Đăng ký nghỉ", () => {
  let branchId: string;
  let me: RunStaff;
  let other: RunStaff;
  let meContext: BrowserContext | undefined;
  let mePage: Page;

  test.beforeEach(async ({ page, browser }) => {
    await login(page);
    branchId = await firstBranchId(page);
    const run = `${runId()}${test.info().workerIndex}`;
    me = await createRunStaff(page, branchId, `lv${run}`, { roleNames: ["admin"] });
    other = await createRunStaff(page, branchId, `lo${run}`);

    meContext = await browser.newContext();
    mePage = await meContext.newPage();
    await login(mePage, { userName: `tk-e2e-lv${run}`, password: RUN_STAFF_PASSWORD });
  });

  test.afterEach(async ({ page }) => {
    await meContext?.close();
    if (me) await deleteStaff(page, me.id);
    if (other) await deleteStaff(page, other.id);
  });

  test("registers several days off with their own shifts and keeps them after a reload", async () => {
    const page = mePage;
    const month = nextMonth();
    await page.goto("/calendar?tab=timekeeping&workSchedule=builder");
    await assertRealApiTraffic(page, "/api/v1/app/time-keepings");
    await page.getByRole("button", { name: "Tháng sau" }).click();

    // Only one's own row opens the dialog.
    await expect(leaveButton(page, other.fullName)).toBeDisabled();
    await leaveButton(page, me.fullName).click();

    const dialog = page.getByRole("dialog", { name: "Đăng ký nghỉ" });
    await expect(dialog.getByText(me.fullName, { exact: true })).toBeVisible();
    // Mã NV / Bộ phận / Phép còn lại are not on the staff record — hidden, not blank.
    await expect(dialog.getByText("Phép còn lại")).toHaveCount(0);

    for (const day of [10, 11, 12]) {
      await dialog.getByRole("button", { name: month.label(day), exact: true }).click();
    }

    const confirm = dialog.getByRole("button", { name: /Xác nhận nghỉ/ });
    // A day without a shift blocks the save and says why.
    await expect(confirm).toBeDisabled();
    await expect(dialog.getByText("Vui lòng chọn ca nghỉ cho ngày này.")).toHaveCount(3);

    await dialog.getByRole("button", { name: "Cả ngày", exact: true }).click(); // "Áp dụng cho tất cả"
    const cards = dialog.locator("section.lv-day");
    await cards.nth(0).getByRole("button", { name: /^Sáng/ }).click();
    await cards.nth(2).getByRole("button", { name: /^Chiều/ }).click();
    // Removing a day drops it from the list and from the count.
    await cards.nth(1).getByRole("button", { name: /^Bỏ ngày/ }).click();
    await expect(cards).toHaveCount(2);
    await expect(dialog.getByText("2 ngày")).toBeVisible();

    await dialog.getByRole("textbox", { name: "2. Lý do nghỉ" }).fill("E2E nghỉ phép");
    await expect(confirm).toBeEnabled();

    const saved = page.waitForResponse(
      (res) => res.url().includes(REGISTER_LEAVE) && res.request().method() === "POST",
    );
    await confirm.click();
    const response = await saved;
    expect(response.status()).toBe(200);
    const records = (await response.json()) as { workDate: string; leaveShift: number; leaveReason: string }[];
    expect(records.map((r) => [r.workDate, r.leaveShift])).toEqual([
      [month.iso(10), 1],
      [month.iso(12), 2],
    ]);
    expect(records.every((r) => r.leaveReason === "E2E nghỉ phép")).toBe(true);
    await expect(dialog).toBeHidden();

    // Persisted: a fresh load reads the half days back out of PostgreSQL.
    await page.reload();
    await assertRealApiTraffic(page, "/api/v1/app/time-keepings");
    await page.getByRole("button", { name: "Tháng sau" }).click();
    await expect(dayCell(page, me.fullName, 10)).toHaveAttribute("title", "Làm buổi chiều (nghỉ sáng)");
    await expect(dayCell(page, me.fullName, 12)).toHaveAttribute("title", "Làm buổi sáng (nghỉ chiều)");
  });

  test("API: leave for another staff member is refused, admin included", async ({ page }) => {
    const month = nextMonth();
    for (const actor of [page, mePage]) {
      const res = await call(actor, REGISTER_LEAVE, {
        method: "POST",
        branchId,
        json: { staffId: other.id, days: [{ workDate: month.iso(15), shift: 3 }] },
      });
      expect(res.status).toBe(403);
      expect(res.body.error?.code).toBe(CELL_LOCKED);
    }
  });

  test("past days cannot be picked", async () => {
    const page = mePage;
    await page.goto("/calendar?tab=timekeeping&workSchedule=builder");
    await leaveButton(page, me.fullName).click();

    const dialog = page.getByRole("dialog", { name: "Đăng ký nghỉ" });
    await dialog.getByRole("button", { name: "Tháng trước" }).click();
    const pastDays = dialog.locator(".lv-cal-day:not(.lv-cal-day--outside)");
    await expect(pastDays.first()).toBeDisabled();
    await expect(pastDays.last()).toBeDisabled();
  });
});
