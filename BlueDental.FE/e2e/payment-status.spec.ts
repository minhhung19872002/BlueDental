import { expect, test, type Page } from "@playwright/test";
import { BRANCH2_USER, login } from "./fixtures/auth";
import {
  call,
  money,
  openNewSlip,
  PAYMENTS_API,
  revisionOf,
  writePendingOnFirstLine,
  type Receipt,
} from "./fixtures/ledgerReceipt";

/**
 * F-58 · Trạng thái phiếu thanh toán (BA 2026-10-08).
 *
 * A receipt written on the plan's Thanh toán tab waits as "Chưa thanh toán":
 * it counts nowhere (paid, debt, revenue, cash book, e-invoice) until
 * "Xác nhận thanh toán" reopens it in the big dialog, where the amount can
 * still change. Confirmed, it is "Hoàn tất" and final — no edit, no cancel.
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

test.describe("Thanh toán: Chưa thanh toán → Xác nhận thanh toán → Hoàn tất", () => {
  test("a new receipt waits, is corrected in the big dialog, and settles only when confirmed", async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 900 });
    await login(page);
    await openNewSlip(page);
    await page.getByRole("tab", { name: "Thanh toán", exact: true }).click();
    await expect(page).toHaveURL(/planTab=payment-v2/);
    planUrl = page.url();
    const owed = await statValue(page, "Công nợ");
    expect(owed).toBeGreaterThan(2);

    // ── Written: "Chưa thanh toán", and nothing on the slip moves ─────────
    const pending = await writePendingOnFirstLine(page);
    const row = receiptRow(page, pending.code);
    await expect(row.locator(".tp-pill")).toHaveText("Chưa thanh toán");
    expect(await statValue(page, "Đã thanh toán")).toBe(0);
    expect(await statValue(page, "Công nợ")).toBe(owed);
    await expect(row.getByRole("button", { name: `Xem phiếu ${pending.code}` })).toBeVisible();
    await expect(row.getByRole("button", { name: `Xác nhận thanh toán phiếu ${pending.code}` })).toBeVisible();
    await expect(row.getByRole("button", { name: `Chỉnh sửa phiếu ${pending.code}` })).toBeVisible();
    await expect(row.getByRole("button", { name: `Huỷ phiếu ${pending.code}` })).toBeVisible();
    // No e-invoice for money not yet taken.
    await expect(row.getByRole("button", { name: /Xuất hóa đơn điện tử/ })).toHaveCount(0);

    // ── Chỉnh sửa: the big dialog, prefilled, saves a new amount ─────────
    await row.getByRole("button", { name: `Chỉnh sửa phiếu ${pending.code}` }).click();
    const editor = page.getByRole("dialog", { name: "Chỉnh sửa phiếu thanh toán" });
    await expect(editor).toBeVisible();
    await expect(editor.locator(".pd-newpay-lines > li input:checked")).toHaveCount(1);
    const amountBox = editor.locator("input.pd-newpay-amount");
    await expect.poll(async () => money(await amountBox.inputValue())).toBe(pending.amount);
    const edited = pending.amount - 1;
    await amountBox.fill(String(edited));
    const updated = page.waitForResponse(
      (res) => res.url().endsWith(`${PAYMENTS_API}/${pending.id}`) && res.request().method() === "PUT",
    );
    await editor.getByRole("button", { name: "Lưu" }).click();
    expect((await updated).ok()).toBeTruthy();
    await expect(editor).toBeHidden();
    await expect(page.getByText("Đã cập nhật phiếu thanh toán")).toBeVisible();
    // Columns: Mã, Ngày tạo, Dịch vụ, Tổng tiền, Thanh toán, …
    await expect.poll(async () => money(await row.locator("td").nth(4).innerText())).toBe(edited);
    await expect(row.locator(".tp-pill")).toHaveText("Chưa thanh toán");
    expect(await statValue(page, "Đã thanh toán")).toBe(0);

    // ── Xác nhận thanh toán: prefilled with the edit, amount changed again ─
    await row.getByRole("button", { name: `Xác nhận thanh toán phiếu ${pending.code}` }).click();
    const confirmDialog = page.getByRole("dialog", { name: "Xác nhận thanh toán" });
    await expect(confirmDialog).toBeVisible();
    const confirmBox = confirmDialog.locator("input.pd-newpay-amount");
    await expect.poll(async () => money(await confirmBox.inputValue())).toBe(edited);
    const collected = edited - 1;
    await confirmBox.fill(String(collected));
    const confirmed = page.waitForResponse(
      (res) => res.url().endsWith(`${PAYMENTS_API}/${pending.id}/confirm`) && res.request().method() === "PUT",
    );
    await confirmDialog.getByRole("button", { name: "Xác nhận thanh toán" }).click();
    const response = await confirmed;
    expect(response.ok()).toBeTruthy();
    receipt = (await response.json()) as Receipt;
    expect(receipt.status).toBe(2);
    expect(receipt.amount).toBe(collected);
    await expect(confirmDialog).toBeHidden();
    await expect(page.getByText("Đã xác nhận thanh toán")).toBeVisible();

    // ── Hoàn tất: the money counts, and the receipt is final ─────────────
    await expect(row.locator(".tp-pill")).toHaveText("Hoàn tất");
    await expect.poll(() => statValue(page, "Đã thanh toán")).toBe(collected);
    await expect.poll(() => statValue(page, "Công nợ")).toBe(owed - collected);
    await expect(row.getByRole("button", { name: `Chỉnh sửa phiếu ${pending.code}` })).toHaveCount(0);
    await expect(row.getByRole("button", { name: `Huỷ phiếu ${pending.code}` })).toHaveCount(0);
    await expect(row.getByRole("button", { name: `Xác nhận thanh toán phiếu ${pending.code}` })).toHaveCount(0);
    await expect(row.getByRole("button", { name: `Xem phiếu ${pending.code}` })).toBeVisible();

    // ── Persisted ────────────────────────────────────────────────────────
    await page.reload();
    await expect(receiptRow(page, pending.code).locator(".tp-pill")).toHaveText("Hoàn tất");
    await expect.poll(() => statValue(page, "Đã thanh toán")).toBe(collected);
    await expect.poll(() => statValue(page, "Công nợ")).toBe(owed - collected);
  });

  test("the API holds the same rules: Hoàn tất is final, Chưa thanh toán counts nowhere", async ({ page }) => {
    expect(receipt, "the first scenario confirms the receipt").toBeDefined();
    const done = receipt!;
    await login(page);

    // A Hoàn tất receipt refuses every write.
    const reEdit = await call(page, `${PAYMENTS_API}/${done.id}`, { method: "PUT", json: revisionOf(done) });
    expect(reEdit.status).toBe(403);
    expect(errorCode(reEdit.body)).toBe(ALREADY_COMPLETED);
    const reConfirm = await call(page, `${PAYMENTS_API}/${done.id}/confirm`, { method: "PUT", json: revisionOf(done) });
    expect(errorCode(reConfirm.body)).toBe(ALREADY_COMPLETED);
    const cancel = await call(page, `${PAYMENTS_API}/${done.id}/cancel`, { method: "POST", json: { reason: "e2e" } });
    expect(errorCode(cancel.body)).toBe(ALREADY_COMPLETED);

    // A fresh Chưa thanh toán receipt on the same line.
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
    expect(written.body.status).toBe(1);
    const pendingId = String(written.body.id);

    try {
      // Not in the account, the counted list or the debt; listed only on request.
      const account = await call(
        page,
        `${PAYMENTS_API}/account?patientId=${done.patientId}&clinicBranchId=${done.clinicBranchId}`,
      );
      expect((account.body.payments as { id: string }[]).map((p) => p.id)).not.toContain(pendingId);
      const plan = (account.body.plans as { id: string; services: { id: string; paidAmount: number }[] }[]).find(
        (p) => p.id === done.treatmentPlanId,
      )!;
      expect(plan.services.find((s) => s.id === done.lines[0].treatmentServiceId)!.paidAmount).toBe(done.amount);
      const base = `${PAYMENTS_API}?patientId=${done.patientId}&treatmentPlanId=${done.treatmentPlanId}&maxResultCount=200`;
      expect(((await call(page, base)).body.items as { id: string }[]).map((p) => p.id)).not.toContain(pendingId);
      const withPending = (await call(page, `${base}&includePending=true`)).body.items as { id: string; status: number }[];
      expect(withPending.find((p) => p.id === pendingId)?.status).toBe(1);

      // No e-invoice and no printed PHIẾU THU before the money is taken.
      const draft = await call(page, `/api/v1/app/e-invoices/draft?patientPaymentId=${pendingId}`);
      expect(errorCode(draft.body)).toBe(NOT_COMPLETED);
      const pdf = await renderReceipt(page, { patientPaymentId: pendingId, lines: [] });
      expect(pdf.status, JSON.stringify(pdf.body)).toBe(403);
      expect(errorCode(pdf.body)).toBe(NOT_COMPLETED);
    } finally {
      // A pending receipt can still be taken back.
      const dropped = await call(page, `${PAYMENTS_API}/${pendingId}/cancel`, { method: "POST", json: { reason: "e2e cleanup" } });
      expect([200, 204]).toContain(dropped.status);
    }

    // A refund is money handed back there and then: written Hoàn tất.
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

  test("another branch cannot confirm a pending receipt", async ({ page, browser }) => {
    expect(receipt).toBeDefined();
    const done = receipt!;
    await login(page);
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
    expect(written.status).toBe(200);
    const pending = written.body as unknown as Receipt;

    const context = await browser.newContext();
    try {
      const other = await context.newPage();
      await login(other, BRANCH2_USER);
      const refused = await call(other, `${PAYMENTS_API}/${pending.id}/confirm`, {
        method: "PUT",
        json: revisionOf(pending),
      });
      expect(refused.status).toBeGreaterThanOrEqual(400);
      expect(refused.status).toBeLessThan(500);

      // Still pending for its own branch.
      const listed = await call(
        page,
        `${PAYMENTS_API}?patientId=${done.patientId}&treatmentPlanId=${done.treatmentPlanId}&includePending=true&maxResultCount=200`,
      );
      expect((listed.body.items as { id: string; status: number }[]).find((p) => p.id === pending.id)?.status).toBe(1);
    } finally {
      await context.close();
      await call(page, `${PAYMENTS_API}/${pending.id}/cancel`, { method: "POST", json: { reason: "e2e cleanup" } });
    }
  });

  test("under 640px the card carries the same confirm, edit and cancel buttons", async ({ page }) => {
    expect(planUrl).not.toBe("");
    await page.setViewportSize({ width: 600, height: 900 });
    await login(page);
    await page.goto(planUrl);
    const pending = await writePendingOnFirstLine(page);
    try {
      const card = page.locator(".bd-rc-card", { hasText: pending.code });
      await expect(card).toBeVisible();
      await expect(card.getByRole("button", { name: `Xác nhận thanh toán phiếu ${pending.code}` })).toBeVisible();
      await expect(card.getByRole("button", { name: `Chỉnh sửa phiếu ${pending.code}` })).toBeVisible();
      await expect(card.getByRole("button", { name: `Huỷ phiếu ${pending.code}` })).toBeVisible();
      const done = page.locator(".bd-rc-card", { hasText: receipt!.code });
      await expect(done.getByRole("button", { name: `Xem phiếu ${receipt!.code}` })).toBeVisible();
      await expect(done.getByRole("button", { name: `Chỉnh sửa phiếu ${receipt!.code}` })).toHaveCount(0);
    } finally {
      await call(page, `${PAYMENTS_API}/${pending.id}/cancel`, { method: "POST", json: { reason: "e2e cleanup" } });
    }
  });
});
