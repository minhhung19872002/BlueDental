import { expect, test, type Locator, type Page } from "@playwright/test";
import { BRANCH2_USER, login } from "./fixtures/auth";
import {
  PAYMENTS_API,
  call,
  collectOnFirstLine,
  openNewSlip,
  type Receipt,
} from "./fixtures/ledgerReceipt";

/**
 * Feature: Tài chính → Thanh toán lists the receipts written with "Tạo Phiếu
 * Thanh Toán" on a treatment plan (BA note, 2026-10-06).
 *
 * The spec walks the BA's own path: a fresh slip, a receipt saved on its
 * Thanh toán tab, then the list. The list is opened before the receipt exists
 * and returned to through browser history — same document, same five-minute
 * cache — so the row only shows if the save invalidated it.
 *
 * Real stack only: real login, real ASP.NET Core API, real PostgreSQL.
 */

const LEDGER_API = "/api/v1/app/payment-ledger";
const EMPTY_TEXT = "Chưa có phiếu thanh toán";
const SEARCH = "Tìm theo mã thanh toán, tên hoặc mã khách hàng...";
const METHOD_LABELS: Record<number, string> = {
  1: "Tiền mặt",
  2: "Ngân hàng",
  3: "Quẹt thẻ",
  4: "Dư nợ",
  5: "Ví momo",
};

const pad = (value: number) => String(value).padStart(2, "0");
const isoDay = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const shownDay = (date: Date) =>
  `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
const vnd = (value: number) => `${value.toLocaleString("vi-VN")}`;

/** Tài chính → Thanh toán through the header menu — a route change, not a page load. */
async function openLedgerFromMenu(page: Page): Promise<void> {
  await page.locator('.app-nav-group[title="Tài chính"]').click();
  await page.locator('.app-ribbon-item[title="Thanh toán"]').click();
  await expect(page).toHaveURL(/\/billing/);
}

async function markDocument(page: Page): Promise<void> {
  await page.evaluate(() => Object.assign(window, { bdSameDocument: true }));
}

async function expectSameDocument(page: Page): Promise<void> {
  expect(await page.evaluate(() => "bdSameDocument" in window), "no reload since the mark").toBe(true);
}

function ledgerRow(page: Page, code: string): Locator {
  return page.locator(".ant-table-tbody tr.ant-table-row").filter({ hasText: code });
}

let receipt: Receipt | undefined;

test.describe.configure({ mode: "serial", timeout: 150_000 });

test.describe("Tài chính → Thanh toán", () => {
  test.afterAll(async ({ browser }) => {
    if (!receipt) return;
    const page = await browser.newPage();
    await login(page);
    await call(page, `${PAYMENTS_API}/${receipt.id}/cancel`, { method: "POST", json: { reason: "e2e cleanup" } });
    await page.close();
  });

  test("a receipt saved on the plan's Thanh toán tab is listed without a reload", async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 900 });
    await login(page);
    await openNewSlip(page);
    await page.getByRole("tab", { name: "Thanh toán", exact: true }).click();
    await expect(page).toHaveURL(/planTab=payment-v2/);
    await markDocument(page);

    // Fill the list's cache before the receipt exists. It opens on today.
    await openLedgerFromMenu(page);
    const picker = page.locator(".bd-period");
    await expect(picker.getByRole("button", { name: "Ngày", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(picker.locator("input")).toHaveValue(shownDay(new Date()));
    await expect(page.locator(".billing-kpi-label")).toHaveText(["Tổng tiền đã thu", "Số phiếu thanh toán"]);

    // Back on the plan, "Tạo Phiếu Thanh Toán".
    await page.goBack();
    await expect(page).toHaveURL(/planTab=payment-v2/);
    receipt = await collectOnFirstLine(page);
    expect(receipt.code).toMatch(/^THANHTOAN/);

    // Forward to the list: same document, and the receipt is there.
    await page.goForward();
    await expect(page).toHaveURL(/\/billing/);
    await expectSameDocument(page);
    await page.getByPlaceholder(SEARCH).fill(receipt.code);
    const row = ledgerRow(page, receipt.code);
    await expect(row).toBeVisible({ timeout: 20_000 });
    await expect(row).toHaveCount(1);
    await expect(row).toContainText(receipt.treatmentPlanCode);
    await expect(row).toContainText(METHOD_LABELS[receipt.method]);
    await expect(row.locator(".billing-ledger-amount")).toHaveText(new RegExp(`^${vnd(receipt.amount)}`));
    await expectSameDocument(page);

    // The cards read the server's totals for the search, not the page.
    const values = page.locator(".billing-kpi-value");
    await expect(values.nth(0)).toHaveText(new RegExp(`^${vnd(receipt.amount)}`));
    await expect(values.nth(1)).toHaveText("1");

    // The plan cell leads back to the receipt's Thanh toán tab.
    await row.getByRole("link").click();
    await expect(page).toHaveURL(
      new RegExp(`/patient/${receipt.patientId}/treatment-plan/${receipt.treatmentPlanId}\\?planTab=payment-v2`),
    );
  });

  test("the list persists, filters by the clinic day, and holds Thanh toán receipts only", async ({ page }) => {
    expect(receipt, "the first scenario saves the receipt").toBeDefined();
    const saved = receipt!;
    await page.setViewportSize({ width: 1600, height: 900 });
    await login(page);

    // Server: today's window holds it, yesterday's does not.
    const today = new Date();
    const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
    const query = (day: Date) =>
      `${LEDGER_API}?filter=${saved.code}&fromDate=${isoDay(day)}&toDate=${isoDay(day)}`;
    const inToday = await call(page, query(today));
    expect(inToday.status).toBe(200);
    expect(inToday.body.totalCount).toBe(1);
    expect(inToday.body.totalAmount).toBe(saved.amount);
    expect(((inToday.body.items as { id: string }[])[0]).id).toBe(saved.id);
    expect((await call(page, query(yesterday))).body.totalCount).toBe(0);

    // A refund on the same line is a receipt too, but not a Thanh toán one.
    const refund = await call(page, PAYMENTS_API, {
      method: "POST",
      json: {
        patientId: saved.patientId,
        clinicBranchId: saved.clinicBranchId,
        treatmentPlanId: saved.treatmentPlanId,
        treatmentServiceIds: [saved.lines[0].treatmentServiceId],
        kind: 2,
        method: 1,
        amount: 1,
        staffId: saved.staffId,
      },
    });
    expect(refund.status, "filing a refund on the paid line").toBe(200);
    try {
      const byPlan = await call(
        page,
        `${LEDGER_API}?filter=${encodeURIComponent(String(refund.body.code))}&fromDate=${isoDay(today)}&toDate=${isoDay(today)}`,
      );
      expect(byPlan.body.totalCount).toBe(0);
    } finally {
      await call(page, `${PAYMENTS_API}/${String(refund.body.id)}/cancel`, { method: "POST", json: { reason: "e2e cleanup" } });
    }

    // Screen, after a full page load.
    await page.goto("/billing");
    await page.getByPlaceholder(SEARCH).fill(saved.code);
    const row = ledgerRow(page, saved.code);
    await expect(row).toBeVisible({ timeout: 20_000 });

    const picker = page.locator(".bd-period");
    await picker.getByRole("button", { name: "Ngày trước" }).click();
    await expect(picker.locator("input")).toHaveValue(shownDay(yesterday));
    await expect(row).toHaveCount(0);
    await expect(page.getByText(EMPTY_TEXT)).toBeVisible();

    await picker.getByRole("button", { name: "Tháng", exact: true }).click();
    await expect(picker.locator("input")).toHaveValue(`${pad(today.getMonth() + 1)}/${today.getFullYear()}`);
    await expect(row).toBeVisible();
  });

  test("Xem opens the receipt sheet and Xuất hoá đơn the e-invoice draft for that receipt", async ({ page }) => {
    expect(receipt).toBeDefined();
    const saved = receipt!;
    await page.setViewportSize({ width: 1600, height: 900 });
    await login(page);

    // The server offers the e-invoice: nothing is billed on this slip yet.
    const listed = await call(page, `${LEDGER_API}?filter=${saved.code}`);
    expect((listed.body.items as { canIssueEInvoice: boolean }[])[0].canIssueEInvoice).toBe(true);

    await page.goto("/billing");
    await page.getByPlaceholder(SEARCH).fill(saved.code);
    const row = ledgerRow(page, saved.code);
    await expect(row).toBeVisible({ timeout: 20_000 });

    // 👁 — the plan tab's own "Chi tiết phiếu", read off the receipt's slip.
    await row.getByRole("button", { name: `Xem phiếu ${saved.code}` }).click();
    const detail = page.getByRole("dialog", { name: "Chi tiết phiếu" });
    await expect(detail).toBeVisible({ timeout: 20_000 });
    await expect(detail.locator(".pdt-receipt-head")).toContainText(saved.code);
    await expect(detail.locator(".pdt-receipt-table tbody tr.ant-table-row")).toHaveCount(saved.lines.length);
    await expect(detail.locator(".pdt-receipt-sum")).toContainText(vnd(saved.amount));
    await expect(detail.getByRole("button", { name: "In Hoá Đơn" })).toBeEnabled();
    await page.keyboard.press("Escape");
    await expect(detail).toBeHidden();

    // 📄 — the e-invoice dialog, drafted from this receipt alone. Not issued:
    // that would reach the provider.
    const drafted = page.waitForResponse(
      (res) => res.url().includes("/api/v1/app/e-invoices/draft") && res.url().includes(saved.id),
    );
    await row.getByRole("button", { name: `Xuất hóa đơn điện tử cho phiếu ${saved.code}` }).click();
    expect((await drafted).ok()).toBeTruthy();
    const invoice = page.getByRole("dialog", { name: "Hóa đơn" });
    await expect(invoice).toBeVisible();
    await expect(invoice.locator("tbody tr.ant-table-row").first()).toBeVisible();
    await expect(invoice.getByRole("button", { name: "Lưu Nháp" })).toBeEnabled();
    await page.keyboard.press("Escape");
    await expect(invoice).toBeHidden();
  });

  test("another branch does not see the receipt", async ({ page }) => {
    expect(receipt).toBeDefined();
    await login(page, BRANCH2_USER);
    const listed = await call(page, `${LEDGER_API}?filter=${receipt!.code}`);
    expect(listed.status).toBe(200);
    expect(listed.body.totalCount).toBe(0);
    expect(listed.body.totalAmount).toBe(0);
  });

  test("a receipt cancelled on its plan leaves the list", async ({ page }) => {
    expect(receipt).toBeDefined();
    const saved = receipt!;
    await login(page);
    const deleted = await call(page, `${PAYMENTS_API}/${saved.id}/cancel`, { method: "POST", json: { reason: "e2e cleanup" } });
    expect([200, 204]).toContain(deleted.status);
    receipt = undefined;

    expect((await call(page, `${LEDGER_API}?filter=${saved.code}`)).body.totalCount).toBe(0);
    await page.goto("/billing");
    await page.getByPlaceholder(SEARCH).fill(saved.code);
    await expect(page.getByText(EMPTY_TEXT)).toBeVisible({ timeout: 20_000 });
    await expect(ledgerRow(page, saved.code)).toHaveCount(0);
  });
});
