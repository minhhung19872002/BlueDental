import { expect, test } from "@playwright/test";
import { assertRealApiTraffic, login } from "./fixtures/auth";

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

    for (const label of [
      "Tổng CBNV",
      "Đăng kí làm",
      "Đăng kí nghỉ",
      "Đang làm việc",
      "Nghỉ ngang",
      "Giờ tăng ca",
    ]) {
      await expect(page.getByText(label, { exact: true })).toBeVisible();
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

  test("opens the work day, then clocks a shift in and out", async ({ page }) => {
    // Attendance is one record per staff per day, so each run takes its own day
    // rather than fighting whatever state today is already in.
    const workDate = freshWorkDate();

    await page.goto(`/calendar?tab=timekeeping&date=${workDate}`);
    await assertRealApiTraffic(page, "/api/v1/app/time-keepings/summary");

    // Attendance cards only exist once the day has been opened for the staff.
    await page.getByRole("button", { name: "Mở ngày làm việc" }).click();

    const card = page.locator("text=LỊCH LÀM VIỆC").first();
    await expect(card).toBeVisible();
    await expect(page.getByText("Chưa vào ca").first()).toBeVisible();

    await page.getByRole("button", { name: "Vào ca" }).first().click();
    await expect(page.getByText("Đang làm việc").first()).toBeVisible();

    await page.getByRole("button", { name: "Ra ca" }).first().click();
    await expect(page.getByText("Hoàn thành").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Đã ra ca" }).first()).toBeVisible();

    // The attendance is server state, not component state.
    await page.goto(`/calendar?tab=timekeeping&date=${workDate}`);
    await expect(page.getByRole("button", { name: "Đã ra ca" }).first()).toBeVisible();
  });
});
