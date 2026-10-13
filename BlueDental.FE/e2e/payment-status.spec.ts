import { expect, test, type Page } from "@playwright/test";
import { BRANCH2_USER, login } from "./fixtures/auth";
import {
  answerYes,
  call,
  money,
  openNewSlip,
  PAYMENTS_API,
  paymentQuestion,
  revisionOf,
  type Receipt,
} from "./fixtures/ledgerReceipt";

/**
 * F-58 · Trạng thái phiếu thanh toán (owner 2026-10-13, replacing BA 2026-10-08).
 *
 * "Lưu" in "Tạo phiếu thanh toán" first asks "Xác nhận thanh toán": "Không"
 * sends nothing and leaves the dialog open, "Có" writes the receipt straight
 * to "Hoàn tất" — it counts at once (paid, debt, e-invoice) and is final: no
 * edit, no cancel, no confirm. No new receipt is ever "Chưa thanh toán" now,
 * so the old pending walk (edit, then confirm in the big dialog) cannot be set
 * up from the app any more and is no longer tested here.
 *
 * Real stack only: real login, real ASP.NET Core API, real PostgreSQL; every
 * follow-up is a separate request or a reload.
 */

const RECEIPT_PDF = "/api/v1/app/e-invoices/receipt-pdf";
const ALREADY_COMPLETED = "BlueDental:Billing:0096";
const NOT_COMPLETED = "BlueDental:Billing:0097";

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

let receipt: Receipt | undefined;
let planUrl = "";

test.describe.configure({ mode: "serial", timeout: 180_000 });

test.describe("Thanh toán: Lưu → Xác nhận thanh toán → Hoàn tất", () => {
  test("a new receipt is asked about first, then is Hoàn tất at once and final", async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 900 });
    await login(page);
    await openNewSlip(page);
    await page.getByRole("tab", { name: "Thanh toán", exact: true }).click();
    await expect(page).toHaveURL(/planTab=payment-v2/);
    planUrl = page.url();
    const owed = await statValue(page, "Công nợ");
    expect(owed).toBeGreaterThan(2);

    const posts: string[] = [];
    page.on("request", (req) => {
      if (req.method() === "POST" && req.url().endsWith(PAYMENTS_API)) posts.push(req.url());
    });

    await page.getByRole("button", { name: "Tạo Phiếu Thanh Toán" }).click();
    const dialog = page.getByRole("dialog", { name: "Tạo phiếu thanh toán" });
    await expect(dialog).toBeVisible();
    // The footer says what saving means now.
    await expect(dialog.locator(".pd-newpay-footer")).toContainText(
      "Phiếu được ghi nhận đã thanh toán ngay khi lưu và không thể sửa hay huỷ.",
    );
    const line = dialog.locator(".pd-newpay-lines > li").first();
    await line.locator("input[type=checkbox]").check();
    const due = money(await line.locator(".pd-newpay-due").innerText());
    const amount = Math.max(2, Math.floor(due / 2));
    const amountBox = dialog.locator(".pd-newpay-amount");
    await amountBox.fill(String(amount));

    // ── "Lưu" asks first, naming the amount; "Không" sends nothing ───────
    await dialog.getByRole("button", { name: "Lưu" }).click();
    const question = paymentQuestion(page);
    await expect(question).toBeVisible();
    await expect(question).toContainText("Xác nhận đã thu");
    await expect(question).toContainText("Phiếu sẽ được ghi nhận là đã thanh toán ngay khi lưu.");
    expect(money(await question.locator(".bd-confirm-message").innerText())).toBe(amount);
    await question.getByRole("button", { name: "Không" }).click();
    await expect(question).toBeHidden();
    await expect(dialog).toBeVisible();
    await expect.poll(async () => money(await amountBox.inputValue())).toBe(amount);
    expect(posts, "Không must not write anything").toHaveLength(0);
    expect(await statValue(page, "Đã thanh toán")).toBe(0);

    // ── "Lưu" again, "Có": one POST, written Hoàn tất ────────────────────
    await dialog.getByRole("button", { name: "Lưu" }).click();
    const saved = await answerYes(page, dialog);
    receipt = saved;
    expect(posts).toHaveLength(1);
    expect(saved.amount).toBe(amount);

    // ── Hoàn tất: the money counts at once, and the receipt is final ─────
    const row = receiptRow(page, saved.code);
    await expect(row.locator(".tp-pill")).toHaveText("Hoàn tất");
    await expect.poll(() => statValue(page, "Đã thanh toán")).toBe(amount);
    await expect.poll(() => statValue(page, "Công nợ")).toBe(owed - amount);
    await expect(row.getByRole("button", { name: `Xem phiếu ${saved.code}` })).toBeVisible();
    await expect(row.getByRole("button", { name: `Chỉnh sửa phiếu ${saved.code}` })).toHaveCount(0);
    await expect(row.getByRole("button", { name: `Huỷ phiếu ${saved.code}` })).toHaveCount(0);
    await expect(row.getByRole("button", { name: `Xác nhận thanh toán phiếu ${saved.code}` })).toHaveCount(0);

    // ── Persisted ────────────────────────────────────────────────────────
    await page.reload();
    await expect(receiptRow(page, saved.code).locator(".tp-pill")).toHaveText("Hoàn tất");
    await expect.poll(() => statValue(page, "Đã thanh toán")).toBe(amount);
    await expect.poll(() => statValue(page, "Công nợ")).toBe(owed - amount);
    expect(posts).toHaveLength(1);
  });

  test("the API holds the same rules: written Hoàn tất, counted at once, and final", async ({ page }) => {
    expect(receipt, "the first scenario writes the receipt").toBeDefined();
    const done = receipt!;
    await login(page);

    // A Hoàn tất receipt refuses every write.
    const reEdit = await call(page, `${PAYMENTS_API}/${done.id}`, { method: "PUT", json: revisionOf(done) });
    expect(reEdit.status).toBe(403);
    expect(errorCode(reEdit.body)).toBe(ALREADY_COMPLETED);
    const reConfirm = await call(page, `${PAYMENTS_API}/${done.id}/confirm`, { method: "PUT", json: revisionOf(done) });
    expect(reConfirm.status).toBe(403);
    expect(errorCode(reConfirm.body)).toBe(ALREADY_COMPLETED);
    const cancel = await call(page, `${PAYMENTS_API}/${done.id}/cancel`, { method: "POST", json: { reason: "e2e" } });
    expect(cancel.status).toBe(403);
    expect(errorCode(cancel.body)).toBe(ALREADY_COMPLETED);

    // A payment written straight through the API is Hoàn tất too.
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
    expect(written.body.status).toBe(2);
    const writtenId = String(written.body.id);

    // In the account, the counted list and the paid figure — on separate requests.
    const account = await call(
      page,
      `${PAYMENTS_API}/account?patientId=${done.patientId}&clinicBranchId=${done.clinicBranchId}`,
    );
    expect((account.body.payments as { id: string }[]).map((p) => p.id)).toContain(writtenId);
    const plan = (account.body.plans as { id: string; services: { id: string; paidAmount: number }[] }[]).find(
      (p) => p.id === done.treatmentPlanId,
    )!;
    expect(plan.services.find((s) => s.id === done.lines[0].treatmentServiceId)!.paidAmount).toBe(done.amount + 1);
    const listed = await call(
      page,
      `${PAYMENTS_API}?patientId=${done.patientId}&treatmentPlanId=${done.treatmentPlanId}&maxResultCount=200`,
    );
    expect((listed.body.items as { id: string; status: number }[]).find((p) => p.id === writtenId)?.status).toBe(2);

    // Money already taken: the PHIẾU THU prints, and the e-invoice draft is
    // not refused as "not completed".
    const draft = await call(page, `/api/v1/app/e-invoices/draft?patientPaymentId=${writtenId}`);
    expect(errorCode(draft.body)).not.toBe(NOT_COMPLETED);
    const pdf = await renderReceipt(page, { patientPaymentId: writtenId, lines: [] });
    expect(errorCode(pdf.body)).not.toBe(NOT_COMPLETED);
    expect(pdf.status, JSON.stringify(pdf.body)).toBe(200);

    // A refund is money handed back there and then: written Hoàn tất as well.
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
    expect(refund.body.status).toBe(2);
  });

  test("another branch cannot edit, confirm or cancel the receipt", async ({ page, browser }) => {
    expect(receipt).toBeDefined();
    const done = receipt!;
    await login(page);

    const context = await browser.newContext();
    try {
      const other = await context.newPage();
      await login(other, BRANCH2_USER);
      const attempts = [
        await call(other, `${PAYMENTS_API}/${done.id}`, { method: "PUT", json: revisionOf(done) }),
        await call(other, `${PAYMENTS_API}/${done.id}/confirm`, { method: "PUT", json: revisionOf(done) }),
        await call(other, `${PAYMENTS_API}/${done.id}/cancel`, { method: "POST", json: { reason: "e2e" } }),
      ];
      for (const refused of attempts) {
        expect(refused.status, JSON.stringify(refused.body)).toBeGreaterThanOrEqual(400);
        expect(refused.status).toBeLessThan(500);
      }

      // Untouched for its own branch.
      const listed = await call(
        page,
        `${PAYMENTS_API}?patientId=${done.patientId}&treatmentPlanId=${done.treatmentPlanId}&maxResultCount=200`,
      );
      const kept = (listed.body.items as { id: string; status: number; amount: number }[]).find(
        (p) => p.id === done.id,
      );
      expect(kept?.status).toBe(2);
      expect(kept?.amount).toBe(done.amount);
    } finally {
      await context.close();
    }
  });

  test("under 640px a Hoàn tất receipt's card offers Xem only", async ({ page }) => {
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
