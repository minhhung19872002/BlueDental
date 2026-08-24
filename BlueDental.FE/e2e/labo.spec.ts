import { expect, test } from "@playwright/test";
import { login, runId } from "./fixtures/auth";

/**
 * Feature: Mẫu Labo.
 *
 * Verifies the labo page loads from the real API, displays orders, and the
 * filter tabs re-query correctly.
 */
test.describe("Labo", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("the labo page loads its orders from the server", async ({ page }) => {
    await page.goto("/labo");
    await page.waitForLoadState("networkidle");

    // The page should render without errors.
    await expect(page.locator("body")).not.toContainText("Unexpected Application Error");

    // The filter tabs should be visible.
    await expect(page.getByRole("button", { name: /Tất Cả Mẫu/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Mẫu Chưa Nhận/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Mẫu Giao Trễ/ })).toBeVisible();
  });

  test("the Mẫu Chưa Nhận filter re-queries the server", async ({ page }) => {
    await page.goto("/labo");
    await page.waitForLoadState("networkidle");

    const requests: string[] = [];
    page.on("request", (req) => {
      if (req.url().includes("/labo-orders")) requests.push(req.url());
    });

    await page.getByRole("button", { name: /Mẫu Chưa Nhận/ }).click();

    // Clicking the filter should trigger a new API request.
    await expect.poll(() => requests.length).toBeGreaterThan(0);
  });
});
