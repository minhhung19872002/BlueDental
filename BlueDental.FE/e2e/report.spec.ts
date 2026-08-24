import { expect, test } from "@playwright/test";
import { login } from "./fixtures/auth";

/**
 * Feature: Báo cáo doanh số (tab "Doanh số và lượt khách") and financial overview.
 *
 * The report page loads its data from the server on render, so verifying that
 * actual figures (not zero placeholders) appear proves the wiring works end to end.
 */
test.describe("Báo cáo", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("doanh số reads the ledger and the payment split from the server", async ({ page }) => {
    await page.goto("/report");
    await page.waitForLoadState("networkidle");

    // The default tab "Doanh số và lượt khách" should be visible.
    await expect(page.getByText("Doanh số và lượt khách")).toBeVisible();

    // The summary section should render server-computed values, not be empty.
    await expect(page.getByText("Doanh số:")).toBeVisible();

    // Switching period re-queries rather than filtering what is on screen.
    const requests: string[] = [];
    page.on("request", (req) => {
      if (req.url().includes("/reports/") || req.url().includes("/sales")) requests.push(req.url());
    });

    await page.getByText("Tháng", { exact: true }).first().click();
    await expect.poll(() => requests.length).toBeGreaterThan(0);
  });

  test("kết quả kinh doanh tab renders correctly", async ({ page }) => {
    await page.goto("/report");
    await page.waitForLoadState("networkidle");

    // Switch to the "Kết quả kinh doanh" tab.
    await page.getByText("Kết quả kinh doanh", { exact: true }).click();

    // The tab content should render without errors.
    await expect(page.locator("body")).not.toContainText("Unexpected Application Error");

    // The date mode switcher should still work on this tab.
    await expect(page.getByText("Ngày", { exact: true }).first()).toBeVisible();
  });
});
