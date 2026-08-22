import { expect, test } from "@playwright/test";
import { assertRealApiTraffic, login } from "./fixtures/auth";

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
});
