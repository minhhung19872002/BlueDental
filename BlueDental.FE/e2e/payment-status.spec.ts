import { expect, test, type Page } from "@playwright/test";
import { BRANCH2_USER, login } from "./fixtures/auth";
import {
  call,
  confirmOnRow,
  confirmQuestion,
  issueReceipt,
  money,
  openNewSlip,
  PAYMENTS_API,
  RECEIPT_STATUS,
  revisionOf,
  saveReceipt,
  type Receipt,
} from "./fixtures/ledgerReceipt";

/**
 * P2610 · Trạng thái phiếu thu (BA 2026-10-27, replacing owner 2026-10-13).
 *
 * "Lưu" in "Tạo phiếu thanh toán" writes the receipt "Chưa thanh toán" at once
 * — no question — and no money moves: it can still be corrected or cancelled.
 * Once exported it is "Đã xuất phiếu thu" and locked, waiting on ✓; ✓ → "Có"
 * makes it "Đã thanh toán", and only then do Đã thanh toán and Công nợ move.
 * An exported or paid receipt is cancelled with one of four fixed reasons, and
 * cancelling a paid one raises the debt again.
 *
 * The iPad signature and the accountant's export are not built yet (phases
 * 4–5): "Đã xuất phiếu thu" is set through the API's interim issue endpoint.
 *
 * Real stack only: real login, real ASP.NET Core API, real PostgreSQL; every
 * follow-up is a separate request or a reload.
 */

const RECEIPT_PDF = "/api/v1/app/e-invoices/receipt-pdf";
const LOCKED = "BlueDental:Billing:0096";
const NOT_COMPLETED = "BlueDental:Billing:0097";
const NOT_ISSUED = "BlueDental:Billing:0098";
const REASON_CODE_REQUIRED = "BlueDental:Billing:0099";
const ALREADY_CANCELLED = "BlueDental:Billing:0100";
const CANCEL_BELOW_REFUNDED = "BlueDental:Billing:0101";

async function statValue(page: Page, label: string): Promise<number> {
  const stat = page.locator(".pdt-stat", { has: page.locator("dt", { hasText: label }) });
  return money(await stat.locator("dd").innerText());
}

function errorCode(body: Record<string, unknown>): string {
  return (body.error as { code?: string } | undefined)?.code ?? "";
}

/** The PHIẾU THU endpoint answers a PDF, so it only speaks JSON errors when asked to. */
async function renderReceipt(page: Page, json: unknown) {
  const cookies = await page.context().cookies();
  const xsrf = cookies.find((cookie) => cookie.name === "XSRF-TOKEN")?.value;
  const res = await page.request.post(RECEIPT_PDF, {
    data: json,
    headers: {
      accept: "application/pdf, application/json",
      ...(xsrf ? { RequestVerificationToken: decodeURIComponent(xsrf) } : {}),
    },
  });
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { status: res.status(), body };
}

function receiptRow(page: Page, code: string) {
  return page.locator(".pdt-table tbody tr.ant-table-row", { hasText: code });
}

async function expectActions(page: Page, code: string, offered: { confirm: boolean; edit: boolean; cancel: boolean }) {
  const row = receiptRow(page, code);
  await expect(row.getByRole("button", { name: `Xem phiếu ${code}` })).toBeVisible();
  await expect(row.getByRole("button", { name: `Xác nhận thanh toán phiếu ${code}` })).toHaveCount(offered.confirm ? 1 : 0);
  await expect(row.getByRole("button", { name: `Chỉnh sửa phiếu ${code}` })).toHaveCount(offered.edit ? 1 : 0);
  await expect(row.getByRole("button", { name: `Huỷ phiếu ${code}` })).toHaveCount(offered.cancel ? 1 : 0);
}

/** The receipts the account counts, and what the slip's line has been paid — on its own request. */
async function linePaid(page: Page, receipt: Receipt): Promise<{ counted: string[]; paid: number }> {
  const account = await call(
    page,
    `${PAYMENTS_API}/account?patientId=${receipt.patientId}&clinicBranchId=${receipt.clinicBranchId}`,
  );
  const plan = (account.body.plans as { id: string; services: { id: string; paidAmount: number }[] }[]).find(
    (p) => p.id === receipt.treatmentPlanId,
  )!;
  return {
    counted: (account.body.payments as { id: string }[]).map((p) => p.id),
    paid: plan.services.find((s) => s.id === receipt.lines[0].treatmentServiceId)!.paidAmount,
  };
}

async function listedStatus(page: Page, receipt: Receipt, id: string): Promise<number | undefined> {
  const listed = await call(
    page,
    `${PAYMENTS_API}?patientId=${receipt.patientId}&treatmentPlanId=${receipt.treatmentPlanId}` +
      "&includePending=true&includeCancelled=true&maxResultCount=200",
  );
  return (listed.body.items as { id: string; status: number }[]).find((p) => p.id === id)?.status;
}

let receipt: Receipt | undefined;
let planUrl = "";
let owedAtStart = 0;

test.describe.configure({ mode: "serial", timeout: 180_000 });

test.describe("Phiếu thu: Chưa thanh toán → Đã xuất phiếu thu → ✓ Đã thanh toán", () => {
  test("Lưu writes a Chưa thanh toán receipt at once, and no money moves", async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 900 });
    await login(page);
    await openNewSlip(page);
    await page.getByRole("tab", { name: "Thanh toán", exact: true }).click();
    await expect(page).toHaveURL(/planTab=payment-v2/);
    planUrl = page.url();
    owedAtStart = await statValue(page, "Công nợ");
    expect(owedAtStart).toBeGreaterThan(2);

    const posts: string[] = [];
    page.on("request", (req) => {
      if (req.method() === "POST" && req.url().endsWith(PAYMENTS_API)) posts.push(req.url());
    });

    await page.getByRole("button", { name: "Tạo Phiếu Thanh Toán" }).click();
    const dialog = page.getByRole("dialog", { name: "Tạo phiếu thanh toán" });
    await expect(dialog).toBeVisible();
    // The footer says what saving means now.
    await expect(dialog.locator(".pd-newpay-footer")).toContainText(
      "Phiếu được tạo ở trạng thái Chưa thanh toán; công nợ chỉ giảm khi phiếu được xác nhận Đã thanh toán.",
    );
    const line = dialog.locator(".pd-newpay-lines > li").first();
    await line.locator("input[type=checkbox]").check();
    const due = money(await line.locator(".pd-newpay-due").innerText());
    const amount = Math.max(2, Math.floor(due / 2));
    await dialog.locator(".pd-newpay-amount").fill(String(amount));

    // ── "Lưu": one POST, no question, written Chưa thanh toán ────────────
    const saved = await saveReceipt(page, dialog);
    receipt = saved;
    expect(posts).toHaveLength(1);
    expect(saved.amount).toBe(amount);
    await expect(confirmQuestion(page)).toHaveCount(0);

    const row = receiptRow(page, saved.code);
    await expect(row.locator(".tp-pill")).toHaveText("Chưa thanh toán");
    await expectActions(page, saved.code, { confirm: false, edit: true, cancel: true });
    expect(await statValue(page, "Đã thanh toán")).toBe(0);
    expect(await statValue(page, "Công nợ")).toBe(owedAtStart);

    // ── Persisted, and still no money in ─────────────────────────────────
    await page.reload();
    await expect(receiptRow(page, saved.code).locator(".tp-pill")).toHaveText("Chưa thanh toán");
    await expect.poll(() => statValue(page, "Công nợ")).toBe(owedAtStart);
    expect(await statValue(page, "Đã thanh toán")).toBe(0);
    expect(posts).toHaveLength(1);
  });

  test("an exported receipt is locked and waits on ✓; ✓ → Có makes it Đã thanh toán", async ({ page }) => {
    expect(receipt, "the first scenario writes the receipt").toBeDefined();
    const pending = receipt!;
    await page.setViewportSize({ width: 1600, height: 900 });
    await login(page);
    await page.goto(planUrl);
    await issueReceipt(page, pending);
    await page.reload();

    // ── Đã xuất phiếu thu: locked, only ✓ left, still no money in ─────────
    const row = receiptRow(page, pending.code);
    await expect(row.locator(".tp-pill")).toHaveText("Đã xuất phiếu thu");
    await expectActions(page, pending.code, { confirm: true, edit: false, cancel: false });
    await expect.poll(() => statValue(page, "Công nợ")).toBe(owedAtStart);
    expect(await statValue(page, "Đã thanh toán")).toBe(0);

    // ── ✓ → "Không" sends nothing ────────────────────────────────────────
    const puts: string[] = [];
    page.on("request", (req) => {
      if (req.method() === "PUT" && req.url().includes(PAYMENTS_API)) puts.push(req.url());
    });
    await row.getByRole("button", { name: `Xác nhận thanh toán phiếu ${pending.code}` }).click();
    const question = confirmQuestion(page);
    await expect(question).toBeVisible();
    // "Xác nhận đã thu {amount} cho phiếu {code}?" — the figure before "cho".
    const asked = await question.locator(".bd-confirm-message").innerText();
    expect(money(asked.split(" cho ")[0])).toBe(pending.amount);
    expect(asked).toContain(`cho phiếu ${pending.code}`);
    await question.getByRole("button", { name: "Không" }).click();
    await expect(question).toBeHidden();
    expect(puts, "Không must not write anything").toHaveLength(0);
    await expect(row.locator(".tp-pill")).toHaveText("Đã xuất phiếu thu");

    // ── ✓ → "Có": Đã thanh toán, and the money counts ────────────────────
    const paid = await confirmOnRow(page, row, pending);
    receipt = paid;
    expect(puts).toHaveLength(1);
    await expect(row.locator(".tp-pill")).toHaveText("Đã thanh toán");
    await expect.poll(() => statValue(page, "Đã thanh toán")).toBe(pending.amount);
    await expect.poll(() => statValue(page, "Công nợ")).toBe(owedAtStart - pending.amount);
    await expectActions(page, pending.code, { confirm: false, edit: false, cancel: false });

    // ── Persisted ────────────────────────────────────────────────────────
    await page.reload();
    await expect(receiptRow(page, pending.code).locator(".tp-pill")).toHaveText("Đã thanh toán");
    await expect.poll(() => statValue(page, "Đã thanh toán")).toBe(pending.amount);
    await expect.poll(() => statValue(page, "Công nợ")).toBe(owedAtStart - pending.amount);
  });

  test("the API holds the same rules, and cancelling a paid receipt raises the debt again", async ({ page }) => {
    expect(receipt).toBeDefined();
    const done = receipt!;
    expect(done.status).toBe(RECEIPT_STATUS.Completed);
    await login(page);

    // A paid receipt refuses every write but the reasoned cancel.
    const writes = [
      { url: `${PAYMENTS_API}/${done.id}`, method: "PUT", json: revisionOf(done) },
      { url: `${PAYMENTS_API}/${done.id}/confirm`, method: "PUT" },
      { url: `${PAYMENTS_API}/${done.id}/issue`, method: "POST" },
    ] as const;
    for (const write of writes) {
      const refused = await call(page, write.url, write);
      expect(refused.status, `${write.method} ${write.url}`).toBe(403);
      expect(errorCode(refused.body)).toBe(LOCKED);
    }

    // A payment written straight through the API is Chưa thanh toán too, and not counted.
    const before = await linePaid(page, done);
    expect(before.paid).toBe(done.amount);
    const written = await call(page, PAYMENTS_API, {
      method: "POST",
      json: {
        patientId: done.patientId,
        clinicBranchId: done.clinicBranchId,
        treatmentPlanId: done.treatmentPlanId,
        treatmentServiceIds: [done.lines[0].treatmentServiceId],
        splitMode: 1,
        items: [],
        kind: 1,
        method: 1,
        amount: 1,
        staffId: done.staffId,
      },
    });
    expect(written.status, JSON.stringify(written.body)).toBe(200);
    expect(written.body.status).toBe(RECEIPT_STATUS.Pending);
    const fresh = written.body as unknown as Receipt;
    expect((await linePaid(page, done)).counted).not.toContain(fresh.id);
    expect(await listedStatus(page, done, fresh.id)).toBe(RECEIPT_STATUS.Pending);

    // Its PHIẾU THU prints right after Lưu, but no e-invoice without money behind it.
    const draftOf = async () =>
      errorCode((await call(page, `/api/v1/app/e-invoices/draft?patientPaymentId=${fresh.id}`)).body);
    const pdf = await renderReceipt(page, { patientPaymentId: fresh.id, lines: [] });
    expect(pdf.status, JSON.stringify(pdf.body)).toBe(200);
    expect(await draftOf()).toBe(NOT_COMPLETED);

    // ✓ before the export is refused; a correction is not.
    const early = await call(page, `${PAYMENTS_API}/${fresh.id}/confirm`, { method: "PUT" });
    expect(early.status).toBe(403);
    expect(errorCode(early.body)).toBe(NOT_ISSUED);
    const revised = await call(page, `${PAYMENTS_API}/${fresh.id}`, { method: "PUT", json: revisionOf(fresh, 2) });
    expect(revised.status, JSON.stringify(revised.body)).toBe(200);
    expect(revised.body.amount).toBe(2);

    // Exported: locked, still not counted, still no e-invoice.
    await issueReceipt(page, fresh);
    const lockedEdit = await call(page, `${PAYMENTS_API}/${fresh.id}`, { method: "PUT", json: revisionOf(fresh, 1) });
    expect(errorCode(lockedEdit.body)).toBe(LOCKED);
    expect((await linePaid(page, done)).paid).toBe(done.amount);
    expect(await draftOf()).toBe(NOT_COMPLETED);

    // ✓: counted from here.
    const confirmed = await call(page, `${PAYMENTS_API}/${fresh.id}/confirm`, { method: "PUT" });
    expect(confirmed.status, JSON.stringify(confirmed.body)).toBe(200);
    expect(confirmed.body.status).toBe(RECEIPT_STATUS.Completed);
    const after = await linePaid(page, done);
    expect(after.counted).toContain(fresh.id);
    expect(after.paid).toBe(done.amount + 2);
    expect(await draftOf()).not.toBe(NOT_COMPLETED);

    // Cancelling a paid receipt needs one of the four fixed reasons; then the money comes off.
    const bare = await call(page, `${PAYMENTS_API}/${fresh.id}/cancel`, { method: "POST", json: { reason: "e2e" } });
    expect(bare.status).toBe(403);
    expect(errorCode(bare.body)).toBe(REASON_CODE_REQUIRED);
    const cancelled = await call(page, `${PAYMENTS_API}/${fresh.id}/cancel`, {
      method: "POST",
      json: { reasonCode: 4, reason: "e2e: thu nhầm" },
    });
    expect(cancelled.status, JSON.stringify(cancelled.body)).toBeLessThan(300);
    expect(await listedStatus(page, done, fresh.id)).toBe(RECEIPT_STATUS.Cancelled);
    const reopened = await linePaid(page, done);
    expect(reopened.counted).not.toContain(fresh.id);
    expect(reopened.paid).toBe(done.amount);
    const again = await call(page, `${PAYMENTS_API}/${fresh.id}/cancel`, {
      method: "POST",
      json: { reasonCode: 4, reason: "e2e" },
    });
    expect(errorCode(again.body)).toBe(ALREADY_CANCELLED);

    // A refund is money handed back there and then: written Đã thanh toán.
    const refund = await call(page, PAYMENTS_API, {
      method: "POST",
      json: {
        patientId: done.patientId,
        clinicBranchId: done.clinicBranchId,
        treatmentPlanId: done.treatmentPlanId,
        treatmentServiceIds: [done.lines[0].treatmentServiceId],
        kind: 2,
        method: 1,
        amount: 1,
        staffId: done.staffId,
      },
    });
    expect(refund.status, JSON.stringify(refund.body)).toBe(200);
    expect(refund.body.status).toBe(RECEIPT_STATUS.Completed);

    // A refund is final, so the paid receipt it drew on can no longer be cancelled.
    const drawnOn = await call(page, `${PAYMENTS_API}/${done.id}/cancel`, {
      method: "POST",
      json: { reasonCode: 4, reason: "e2e" },
    });
    expect(drawnOn.status).toBe(403);
    expect(errorCode(drawnOn.body)).toBe(CANCEL_BELOW_REFUNDED);
    expect(await listedStatus(page, done, done.id)).toBe(RECEIPT_STATUS.Completed);
  });

  test("another branch can neither edit, export, confirm nor cancel the receipt", async ({ page, browser }) => {
    expect(receipt).toBeDefined();
    const done = receipt!;
    await login(page);

    const context = await browser.newContext();
    try {
      const other = await context.newPage();
      await login(other, BRANCH2_USER);
      const attempts = [
        await call(other, `${PAYMENTS_API}/${done.id}`, { method: "PUT", json: revisionOf(done) }),
        await call(other, `${PAYMENTS_API}/${done.id}/issue`, { method: "POST" }),
        await call(other, `${PAYMENTS_API}/${done.id}/confirm`, { method: "PUT" }),
        await call(other, `${PAYMENTS_API}/${done.id}/cancel`, { method: "POST", json: { reasonCode: 4, reason: "e2e" } }),
      ];
      for (const refused of attempts) {
        expect(refused.status, JSON.stringify(refused.body)).toBeGreaterThanOrEqual(400);
        expect(refused.status).toBeLessThan(500);
      }

      // Untouched for its own branch.
      expect(await listedStatus(page, done, done.id)).toBe(RECEIPT_STATUS.Completed);
    } finally {
      await context.close();
    }
  });

  test("under 640px a paid receipt's card offers Xem only", async ({ page }) => {
    expect(planUrl).not.toBe("");
    const done = receipt!;
    await page.setViewportSize({ width: 600, height: 900 });
    await login(page);
    await page.goto(planUrl);
    const card = page.locator(".bd-rc-card", { hasText: done.code });
    await expect(card).toBeVisible();
    await expect(card.getByRole("button", { name: `Xem phiếu ${done.code}` })).toBeVisible();
    await expect(card.getByRole("button", { name: `Xác nhận thanh toán phiếu ${done.code}` })).toHaveCount(0);
    await expect(card.getByRole("button", { name: `Chỉnh sửa phiếu ${done.code}` })).toHaveCount(0);
    await expect(card.getByRole("button", { name: `Huỷ phiếu ${done.code}` })).toHaveCount(0);
  });
});
