import { expect, test } from "@playwright/test";
import { login } from "./fixtures/auth";

/**
 * Feature: Chăm sóc khách hàng (CSKH).
 *
 * Verifies the CSKH page loads its data from the real API, displays
 * the status counters, and the care type tabs re-query correctly.
 */
test.describe("CSKH", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("the page loads its status counters from the server", async ({ page }) => {
    await page.goto("/cskh-grouping");
    await page.waitForLoadState("networkidle");

    // The status filter buttons should be visible with counts.
    await expect(page.getByRole("button", { name: /\d+\s*Tổng khách/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /\d+\s*Thành công/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /\d+\s*Chưa CS/ })).toBeVisible();
  });

  test("switching care programme re-queries the server", async ({ page }) => {
    await page.goto("/cskh-grouping");
    await page.waitForLoadState("networkidle");

    const requests: string[] = [];
    page.on("request", (req) => {
      if (req.url().includes("/care-records")) requests.push(req.url());
    });

    await page.getByRole("button", { name: "Chúc mừng sinh nhật" }).click();

    await expect.poll(() => requests.length).toBeGreaterThan(0);
  });
});
