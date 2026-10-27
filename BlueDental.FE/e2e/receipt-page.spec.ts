import { expect, test, type Page } from "@playwright/test";
import { BRANCH2_USER, login } from "./fixtures/auth";
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
 * P2610 phase 3 · Tài chính → Phiếu thu (`/billing/receipts/:id`, R-1045).
 *
 * A receipt has its own page: the six-step bar, the PHIẾU THU sheet drawn from
 * the content frozen when it was written, and a status column. The slip's
 * Thanh toán tab opens it from the receipt's number or 👁.
 *
 * Real stack only: real login, real ASP.NET Core API, real PostgreSQL; every
 * follow-up is a reload or a separate request.
 */

const STEPS = [
  "Tạo phiếu thu",
  "Gửi tới iPad",
  "Khách kiểm tra",
  "Khách đồng ý & ký",
  "Kế toán kiểm tra",
  "Xuất phiếu thu",
];

interface ReceiptContent {
  payerName: string;
  planCode: string;
  amount: number;
  lines: { name: string; amount: number }[];
}

const steps = (page: Page) => page.locator(".rcpt-track-card .step-track-item");

async function expectStepsDone(page: Page, done: number, current: string | null): Promise<void> {
  await expect(steps(page).locator(".step-track-label")).toHaveText(STEPS);
  await expect(page.locator(".rcpt-track-card .step-track-item--done")).toHaveCount(done);
  const now = page.locator(".rcpt-track-card .step-track-item--current");
  if (current === null) {
    await expect(now).toHaveCount(0);
    return;
  }
  await expect(now).toHaveCount(1);
  await expect(now.locator(".step-track-label")).toHaveText(current);
  await expect(now.locator(".step-track-caption")).toHaveText("Đang thực hiện");
  await expect(now).toHaveAttribute("aria-current", "step");
}

/** The receipt page's own read, as a separate request. */
async function receiptContent(page: Page, receipt: Pick<Receipt, "id">): Promise<ReceiptContent> {
  const read = await call(page, `${PAYMENTS_API}/${receipt.id}/receipt`);
  expect(read.status, JSON.stringify(read.body)).toBe(200);
  return read.body.content as unknown as ReceiptContent;
}

/** A catalog write on the real API, scoped to the receipt's branch as the app sends it. */
async function sendForBranch(page: Page, branchId: string, url: string, method: "GET" | "PUT", json?: unknown) {
  const cookies = await page.context().cookies();
  const xsrf = cookies.find((cookie) => cookie.name === "XSRF-TOKEN")?.value;
  const res = await page.request.fetch(url, {
    method,
    data: json,
    headers: {
      Accept: "application/json",
      "X-Clinic-Branch-Id": branchId,
      ...(xsrf ? { RequestVerificationToken: decodeURIComponent(xsrf) } : {}),
    },
  });
  expect(res.status(), await res.text()).toBe(200);
  return (await res.json()) as Record<string, unknown>;
}

test.describe.serial("Tài chính → Phiếu thu", () => {
  let receipt: Receipt | null = null;

  test("the number on the Thanh toán tab opens the receipt page; its steps follow the status", async ({ page }) => {
    await login(page);
    const { slip } = await openNewSlip(page);
    await page.getByRole("tab", { name: "Thanh toán", exact: true }).click();
    const written = await writeOnFirstLine(page);
    receipt = written;

    // ── The receipt's number on its row is a link to its page ───────────────
    const row = page.locator(".ant-table-row", { hasText: written.code });
    await row.locator(".pdt-code-link", { hasText: written.code }).click();
    await expectReceiptPage(page, written);
    await expect(page.locator(".rcpt-crumbs")).toContainText("Tài chính");
    await expect(page.locator(".rcpt-head-meta")).toContainText(slip.code);

    // ── Written: step 1 done, waiting on "Gửi tới iPad" ────────────────────
    await expect(page.locator(".rcpt-pill")).toHaveText("Chưa thanh toán");
    await expectStepsDone(page, 1, "Gửi tới iPad");
    const panel = page.getByRole("complementary", { name: "Trạng thái" });
    await expect(panel.locator(".rcpt-panel-title")).toHaveText("Chờ gửi tới iPad");
    await expect(panel.getByRole("button", { name: "In phiếu thu" })).toBeVisible();

    // The sheet as written: its number, the slip, the one line and its share.
    const content = await receiptContent(page, written);
    expect(content.planCode).toBe(slip.code);
    expect(content.amount).toBe(written.amount);
    expect(content.lines).toHaveLength(1);
    expect(content.lines[0].name).toBe(slip.serviceName);
    const sheet = page.locator(".rcpt-sheet");
    await expect(sheet.locator(".rcpt-sheet-title")).toHaveText("PHIẾU THU");
    await expect(sheet).toContainText(content.payerName);
    await expect(sheet).toContainText(`(${slip.code})`);
    await expect(sheet.locator(".rcpt-lines tbody tr")).toHaveText([new RegExp(slip.serviceName)]);
    await expect(sheet.locator(".rcpt-sign-role")).toHaveText(["Người nộp tiền", "Kế toán / Người lập phiếu"]);

    // ── Exported: all six steps done, none waiting ──────────────────────────
    await issueReceipt(page, written);
    await page.reload();
    await expect(page.locator(".rcpt-pill")).toHaveText("Đã xuất phiếu thu");
    await expectStepsDone(page, 6, null);
    await expect(panel.locator(".rcpt-panel-title")).toHaveText("Đã xuất phiếu thu");
    // The mock's column: how it was signed and kept (receipt-exported.spec covers the buttons).
    await expect(panel.locator(".rcpt-done-fact dd")).toHaveText([/^Không ký số – /, "Chưa ký số", /^PDF\/A/]);

    // ── Paid: still six; the same column under "Đã thanh toán", plus who confirmed ──
    // Already exported, so ✓ only.
    const confirmed = await call(page, `${PAYMENTS_API}/${written.id}/confirm`, { method: "PUT" });
    expect(confirmed.status, JSON.stringify(confirmed.body)).toBe(200);
    expect(confirmed.body.status).toBe(RECEIPT_STATUS.Completed);
    await page.reload();
    await expect(page.locator(".rcpt-pill")).toHaveText("Đã thanh toán");
    await expectStepsDone(page, 6, null);
    await expect(panel.locator(".rcpt-panel-title")).toHaveText("Đã thanh toán");
    await expect(panel.locator(".rcpt-done-icon")).toBeVisible();
    await expect(panel.locator(".rcpt-done-fact dt")).toHaveText([
      "Hình thức ký",
      "Ký số đơn vị",
      "Lưu trữ",
      "Xác nhận thanh toán",
    ]);
    await expect(panel.locator(".rcpt-done-fact dd").last()).not.toHaveText("—");
    await expect(panel.locator(".rcpt-done-actions").getByRole("button")).toHaveText([
      "In phiếu",
      "Tải PDF",
      "Tạo phiếu mới",
    ]);

    // ← goes back to the slip's Thanh toán tab.
    await page.getByRole("link", { name: "Quay lại" }).click();
    await expect(page).toHaveURL(new RegExp(`/treatment-plan/${slip.id}.*planTab=payment-v2`));
    await expect(page.locator(".ant-table-row", { hasText: written.code })).toBeVisible();
  });

  test("the sheet keeps what was written when the service is renamed later", async ({ page }) => {
    await login(page);
    const { slip } = await openNewSlip(page);
    await page.getByRole("tab", { name: "Thanh toán", exact: true }).click();
    const written = await writeOnFirstLine(page);
    const branch = written.clinicBranchId;

    const list = await sendForBranch(
      page,
      branch,
      `/api/v1/app/catalog-entries?clinicBranchId=${branch}&group=care_service&isActive=true&maxResultCount=1000`,
      "GET",
    );
    const entries = list.items as { id: string; name: string; isDeleted: boolean }[];
    const entry = entries.find((item) => !item.isDeleted && item.name === slip.serviceName);
    expect(entry, `catalog entry "${slip.serviceName}"`).toBeTruthy();
    const original = await sendForBranch(page, branch, `/api/v1/app/catalog-entries/${entry!.id}`, "GET");
    const renamed = `${slip.serviceName} (đổi tên)`;
    try {
      await sendForBranch(page, branch, `/api/v1/app/catalog-entries/${entry!.id}`, "PUT", { ...original, name: renamed });

      // A separate read and the page both still print the name as written.
      expect((await receiptContent(page, written)).lines[0].name).toBe(slip.serviceName);
      await page.goto(`/billing/receipts/${written.id}`);
      await expectReceiptPage(page, written);
      await expect(page.locator(".rcpt-lines tbody tr")).toHaveText([new RegExp(slip.serviceName)]);
      await expect(page.locator(".rcpt-lines")).not.toContainText(renamed);
    } finally {
      await sendForBranch(page, branch, `/api/v1/app/catalog-entries/${entry!.id}`, "PUT", original);
    }
  });

  test("another branch's account cannot open the receipt", async ({ page, browser }) => {
    expect(receipt).not.toBeNull();
    const own = receipt!;
    const context = await browser.newContext();
    try {
      const other = await context.newPage();
      await login(other, BRANCH2_USER);
      const read = await call(other, `${PAYMENTS_API}/${own.id}/receipt`);
      expect(read.status, JSON.stringify(read.body)).toBeGreaterThanOrEqual(400);
      expect(read.status).toBeLessThan(500);
      await other.goto(`/billing/receipts/${own.id}`);
      await expect(other.getByText("Không mở được phiếu thu")).toBeVisible({ timeout: 20_000 });
      await expect(other.locator(".rcpt-sheet")).toHaveCount(0);
    } finally {
      await context.close();
    }

    // Its own branch still reads it.
    await login(page);
    expect((await receiptContent(page, own)).planCode).toBe(own.treatmentPlanCode);
  });
});
