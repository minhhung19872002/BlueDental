import { expect, test, type Page } from "@playwright/test";
import { login } from "./fixtures/auth";
import {
  call,
  expectReceiptPage,
  issueReceipt,
  openNewSlip,
  PAYMENTS_API,
  RECEIPT_STATUS,
  writeOnFirstLine,
  type Receipt,
} from "./fixtures/ledgerReceipt";

/**
 * P2610 phase 6 · Hủy phiếu thu (`/billing/receipts/:id/cancel`).
 *
 * "Hủy phiếu thu" at the top right of the receipt page opens its own page:
 * Phiếu thu gốc on the left, one of four fixed reasons and a required
 * description on the right. At every step (BA 27/10): only the status changes,
 * the receipt is kept and reads "Phiếu bị hủy", and it is never reopened.
 *
 * Real stack only: real login, real ASP.NET Core API, real PostgreSQL; every
 * follow-up is a reload or a separate request.
 */

const CANCEL = "Hủy phiếu thu";
const SUBMIT = "Gửi yêu cầu hủy";
const REASONS = ["Sai thông tin người nộp", "Sai số tiền / dịch vụ", "Lập trùng phiếu", "Lý do khác"];

async function writeReceipt(page: Page): Promise<Receipt> {
  await login(page);
  await openNewSlip(page);
  await page.getByRole("tab", { name: "Thanh toán", exact: true }).click();
  return writeOnFirstLine(page);
}

async function openReceiptPage(page: Page, receipt: Receipt): Promise<void> {
  await page.goto(`/billing/receipts/${receipt.id}`);
  await expectReceiptPage(page, receipt);
}

/** From the header button to the cancel page, filled and sent; ends back on the receipt page. */
async function cancelFromPage(page: Page, receipt: Receipt, reason: string, detail: string): Promise<void> {
  await page.locator(".rcpt-head").getByRole("button", { name: CANCEL }).click();
  await expect(page).toHaveURL(new RegExp(`/billing/receipts/${receipt.id}/cancel`));
  await expect(page.locator(".rcpt-head-code")).toHaveText(CANCEL);
  await expect(page.locator(".rcpt-crumbs")).toContainText(receipt.code);

  const original = page.getByRole("region", { name: "Phiếu thu gốc" });
  await expect(original).toContainText(receipt.code);

  const submit = page.getByRole("button", { name: SUBMIT });
  await expect(page.getByRole("radio")).toHaveCount(REASONS.length);
  for (const name of REASONS) await expect(page.getByRole("radio", { name })).toBeVisible();
  // Both are required (BA): off until a reason is picked and the details typed.
  await expect(submit).toBeDisabled();
  await page.getByRole("radio", { name: reason }).check();
  await expect(submit).toBeDisabled();
  await page.getByLabel("Mô tả chi tiết").fill("   ");
  await expect(submit).toBeDisabled();
  await page.getByLabel("Mô tả chi tiết").fill(detail);

  const sent = page.waitForResponse(
    (res) => res.url().endsWith(`${PAYMENTS_API}/${receipt.id}/cancel`) && res.request().method() === "POST",
  );
  await submit.click();
  const response = await sent;
  expect(response.ok(), await response.text()).toBeTruthy();
  await expect(page).toHaveURL(new RegExp(`/billing/receipts/${receipt.id}(\\?|$)`));
}

/** Cancelled: the pill, the reason on the panel, no way back to the cancel page. */
async function expectCancelled(page: Page, receipt: Receipt, reason: string, detail: string): Promise<void> {
  await page.reload();
  await expect(page.locator(".rcpt-head .rcpt-pill")).toHaveText("Phiếu bị hủy");
  const panel = page.getByRole("complementary", { name: "Trạng thái" });
  await expect(panel).toContainText(reason);
  await expect(panel).toContainText(detail);
  await expect(page.locator(".rcpt-head").getByRole("button", { name: CANCEL })).toHaveCount(0);

  // Never reopened: the cancel page sends a cancelled receipt back to its own page.
  await page.goto(`/billing/receipts/${receipt.id}/cancel`);
  await expect(page).toHaveURL(new RegExp(`/billing/receipts/${receipt.id}(\\?|$)`));
  await expect(page.locator(".rcpt-head .rcpt-pill")).toHaveText("Phiếu bị hủy");
}

test.describe.serial("Tài chính → Phiếu thu → Hủy phiếu thu", () => {
  test("an exported receipt is cancelled with a reason; it is kept and reads Phiếu bị hủy", async ({ page }) => {
    const written = await writeReceipt(page);
    await issueReceipt(page, written);
    await openReceiptPage(page, written);
    await expect(page.locator(".rcpt-head .rcpt-pill")).toHaveText("Đã xuất phiếu thu");

    // Quay lại leaves it as it was.
    await page.locator(".rcpt-head").getByRole("button", { name: CANCEL }).click();
    await expect(page).toHaveURL(/\/cancel/);
    await expect(page.getByRole("region", { name: "Phiếu thu gốc" })).toContainText("Khách đã ký · Không ký số");
    await page.getByRole("button", { name: "Quay lại" }).click();
    await expect(page.locator(".rcpt-head .rcpt-pill")).toHaveText("Đã xuất phiếu thu");

    const detail = `Ghi nhầm dịch vụ e2e ${written.code}`;
    await cancelFromPage(page, written, "Sai số tiền / dịch vụ", detail);
    await expectCancelled(page, written, "Sai số tiền / dịch vụ", detail);

    // A separate read: still there, cancelled, with the fixed reason and the words.
    const read = await call(page, `${PAYMENTS_API}/${written.id}/receipt`);
    expect(read.status, JSON.stringify(read.body)).toBe(200);
    expect(read.body.status).toBe(RECEIPT_STATUS.Cancelled);
    expect(read.body.cancelReasonCode).toBe(2);
    expect(read.body.cancelReason).toBe(detail);
    expect(read.body.cancelledAt).toBeTruthy();
    expect(read.body.issuedAt).toBeTruthy();
    expect(read.body.cancelledAt).not.toBe(read.body.issuedAt);
  });

  test("a receipt still waiting on the iPad is cancelled the same way (BA: every step)", async ({ page }) => {
    const written = await writeReceipt(page);
    await openReceiptPage(page, written);
    await expect(page.locator(".rcpt-head .rcpt-pill")).toHaveText("Chưa thanh toán");

    const detail = `Lập trùng e2e ${written.code}`;
    await cancelFromPage(page, written, "Lập trùng phiếu", detail);
    await expectCancelled(page, written, "Lập trùng phiếu", detail);

    const read = await call(page, `${PAYMENTS_API}/${written.id}/receipt`);
    expect(read.status, JSON.stringify(read.body)).toBe(200);
    expect(read.body.status).toBe(RECEIPT_STATUS.Cancelled);
    expect(read.body.cancelReasonCode).toBe(3);
  });
});
