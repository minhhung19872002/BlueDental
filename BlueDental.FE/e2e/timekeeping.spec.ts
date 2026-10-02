import { expect, test } from "@playwright/test";
import { assertRealApiTraffic, login, runId } from "./fixtures/auth";
import { createRunStaff, deleteStaff, firstBranchId } from "./fixtures/timekeepingStaff";

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
    const kpis = page.getByTestId("timekeeping-kpis");

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
    const staff = await createRunStaff(page, branchId, run);
    try {
      await page.goto(`/calendar?tab=timekeeping&branchId=${branchId}`);
      await assertRealApiTraffic(page, "/api/v1/app/time-keepings/summary");

      const findCard = async () => {
        await page
          .locator(".floating-field", { hasText: "Tìm kiếm" })
          .getByRole("textbox")
          .fill(run);
        const card = page.locator(".tk-card", { hasText: run });
        await expect(card).toHaveCount(1);
        return card;
      };

      let card = await findCard();
      // Today without a check-in reads OFF ("Vắng"); only a day still to come
      // stays neutral ("Không điểm danh").
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
});
