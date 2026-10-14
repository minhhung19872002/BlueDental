import { expect, test, type Page, type Response } from "@playwright/test";
import { login } from "./fixtures/auth";
import { collectOnFirstLine, openNewSlip } from "./fixtures/ledgerReceipt";

/**
 * Feature: Báo cáo reads the header's branch and re-reads on every visit
 * (owner, 2026-10-14: the tabs disagreed — one figure per branch, another
 * summed over every branch, and a tab kept its five-minute-old totals).
 *
 * Real stack: the receipt is written through "Tạo Phiếu Thanh Toán" in a
 * second tab of the same session; nothing is intercepted.
 */

const RESULT_API = "/api/v1/app/clinic-reports/business-result";
const BRANCH = "11111111-1111-1111-1111-111111111111";

interface BusinessResult {
  treatmentIncome: number;
}

const isResultRead = (res: Response) =>
  res.url().includes(RESULT_API) && res.request().method() === "GET" && res.ok();

async function selectTab(page: Page, name: string) {
  await expect(async () => {
    await page.getByRole("tab", { name, exact: true }).first().click();
    await expect(page.getByRole("tab", { name, exact: true }).first()).toHaveAttribute("aria-selected", "true", {
      timeout: 2_000,
    });
  }).toPass({ timeout: 15_000 });
}

test("Kết quả kinh doanh follows the branch and re-reads on return, so a new receipt shows", async ({
  page,
  context,
}) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 1600, height: 900 });
  await login(page);

  // ── the branch rides along ──────────────────────────────────────────────
  const first = page.waitForResponse(isResultRead);
  await page.goto("/report?reportTab=result&report_dateMode=day&branch=BD-001");
  const firstRead = await first;
  expect(new URL(firstRead.url()).searchParams.get("clinicBranchId")).toBe(BRANCH);
  const before = ((await firstRead.json()) as BusinessResult).treatmentIncome;

  // ── leaving the tab and coming back reads again ─────────────────────────
  await selectTab(page, "Quản lý thu chi");
  const back = page.waitForResponse(isResultRead);
  await selectTab(page, "Kết quả kinh doanh");
  await back;

  // ── money taken elsewhere shows up once the window is back in front ─────
  const cashier = await context.newPage();
  await cashier.setViewportSize({ width: 1600, height: 900 });
  await openNewSlip(cashier);
  await cashier.getByRole("tab", { name: "Thanh toán", exact: true }).click();
  const receipt = await collectOnFirstLine(cashier);
  expect(receipt.clinicBranchId).toBe(BRANCH);
  await cashier.close();

  const refreshed = page.waitForResponse(isResultRead);
  // What the browser fires when the user returns to this tab.
  await page.evaluate(() => window.dispatchEvent(new Event("visibilitychange")));
  const after = ((await (await refreshed).json()) as BusinessResult).treatmentIncome;
  expect(after - before).toBe(receipt.amount);
});
