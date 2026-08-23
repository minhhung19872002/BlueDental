import { expect, test, type Page } from "@playwright/test";
import { assertRealApiTraffic, login } from "./fixtures/auth";

/**
 * Feature: Báo cáo doanh số (13.1) và kết quả kinh doanh (13.3).
 *
 * Both tabs used to render zeroes. Every figure is now derived by the server
 * from the slips, the money movements and the thu chi vouchers.
 */
test.describe("Báo cáo", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  /** Parses a Vietnamese amount, keeping the sign a loss carries. */
  function parseAmount(text: string): number {
    const digits = Number(text.replace(/[^\d]/g, "") || 0);
    return /[-−]/.test(text) ? -digits : digits;
  }

  const cardAmount = async (page: Page, testId: string): Promise<number> =>
    parseAmount(await page.getByTestId(testId).innerText());

  const rowAmount = async (page: Page, label: string): Promise<number> => {
    const row = page.getByRole("row", { name: new RegExp(label) });
    return parseAmount(await row.innerText());
  };

  test("doanh số reads the ledger and the payment split from the server", async ({ page }) => {
    // The tab fires both queries at once, so the listeners go up before the load.
    const stat = assertRealApiTraffic(page, "/api/v1/app/clinic-reports/payment-stat");
    const history = assertRealApiTraffic(page, "/api/v1/app/clinic-reports/patient-history");

    await page.goto("/report");
    await Promise.all([stat, history]);

    // The cards are server figures, not zero placeholders.
    await expect(page.getByTestId("sales-visits")).toBeVisible();
    await expect(page.getByTestId("sales-methods")).toContainText("Tiền mặt");

    // Switching period re-queries rather than filtering what is on screen.
    const requests: string[] = [];
    page.on("request", (req) => {
      if (req.url().includes("/clinic-reports/payment-stat")) requests.push(req.url());
    });

    await page.getByText("Tháng", { exact: true }).first().click();
    await expect.poll(() => requests.length).toBeGreaterThan(0);
  });

  test("kết quả kinh doanh is revenue less refunds and expenses", async ({ page }) => {
    await page.goto("/report?tab=result");
    await assertRealApiTraffic(page, "/api/v1/app/clinic-reports/business-result");

    const revenue = await cardAmount(page, "result-revenue");
    const expense = await cardAmount(page, "result-expense");
    const profit = await cardAmount(page, "result-profit");

    // The six rows are the reference's, and they must agree with the cards.
    expect(await rowAmount(page, "Doanh thu tổng")).toBe(revenue);
    expect(await rowAmount(page, "Kết quả kinh doanh")).toBe(profit);

    const treatmentIncome = await rowAmount(page, "Thu từ dịch vụ điều trị");
    const otherIncome = await rowAmount(page, "Thu khác");
    const refund = await rowAmount(page, "Hoàn tiền từ dịch vụ điều trị");

    // Revenue is what came in; the result is what is left after refunds and costs.
    expect(treatmentIncome + otherIncome).toBe(revenue);
    expect(profit).toBe(revenue + refund - expense);
  });
});
