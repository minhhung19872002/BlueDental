import { expect, test, type Page } from "@playwright/test";
import { BRANCH2_USER, login } from "./fixtures/auth";
import {
  call,
  openNewSlip,
  PAYMENTS_API,
  RECEIPT_STATUS,
  SIGN_MODE,
  signOnStation,
  withPairedIpad,
  writeOnFirstLine,
  type Receipt,
} from "./fixtures/ledgerReceipt";

/**
 * P2610 phase 5 · "Kế toán kiểm tra & xuất phiếu thu" (R-1049).
 *
 * The export writes the PHIẾU THU once — PDF/A with the customer's signature,
 * sealed in blob storage with its SHA-256 — and only after the customer has
 * signed on a paired iPad. Ký số waits for phase 7. The panel and the new tab
 * are walked in receipt-ipad.spec.ts; this spec holds the API's rules.
 *
 * Real stack only: real login, real ASP.NET Core API, real PostgreSQL, real
 * MinIO and Gotenberg; every follow-up is a separate request.
 */

const LOCKED = "BlueDental:Billing:0096";
const NOT_SIGNED = "BlueDental:Billing:0112";
const DIGITAL_UNAVAILABLE = "BlueDental:Billing:0113";
const FILE_MISSING = "BlueDental:Billing:0114";

const errorCode = (body: Record<string, unknown>) => (body.error as { code?: string } | undefined)?.code ?? "";

const exportAs = (page: Page, receipt: Pick<Receipt, "id">, signMode: number) =>
  call(page, `${PAYMENTS_API}/${receipt.id}/export`, { method: "POST", json: { signMode } });

/** As the app asks for it: with a JSON Accept, so a refusal comes back as ABP’s error body (R-716). */
const receiptFile = (page: Page, receipt: Pick<Receipt, "id">) =>
  page.request.get(`${PAYMENTS_API}/${receipt.id}/receipt-file`, { headers: { Accept: "application/json, */*" } });

/** The receipt page’s own read, as a separate request. */
async function receiptRead(page: Page, receipt: Pick<Receipt, "id">): Promise<Record<string, unknown>> {
  const read = await call(page, `${PAYMENTS_API}/${receipt.id}/receipt`);
  expect(read.status, JSON.stringify(read.body)).toBe(200);
  return read.body;
}

const statusOf = async (page: Page, receipt: Pick<Receipt, "id">) => (await receiptRead(page, receipt)).status;

test.describe.serial("Xuất phiếu thu", () => {
  let receipt: Receipt | null = null;

  test("export waits for the customer's signature; Ký số is refused; the stored file reads back as PDF/A", async ({ page }) => {
    await login(page);
    await openNewSlip(page);
    await page.getByRole("tab", { name: "Thanh toán", exact: true }).click();
    const written = await writeOnFirstLine(page);
    receipt = written;

    // ── Not signed yet: refused, nothing stored ─────────────────────────────
    const unsigned = await exportAs(page, written, SIGN_MODE.Unsigned);
    expect(unsigned.status, JSON.stringify(unsigned.body)).toBe(403);
    expect(errorCode(unsigned.body)).toBe(NOT_SIGNED);
    const none = await receiptFile(page, written);
    expect(none.status()).toBe(403);
    expect(errorCode(await none.json())).toBe(FILE_MISSING);
    expect(await statusOf(page, written)).toBe(RECEIPT_STATUS.Pending);

    await withPairedIpad(page, written, async (token) => {
      await signOnStation(page, written, token);

      // ── Ký số: not until the signing certificate is wired in ──────────────
      const digital = await exportAs(page, written, SIGN_MODE.Digital);
      expect(digital.status, JSON.stringify(digital.body)).toBe(403);
      expect(errorCode(digital.body)).toBe(DIGITAL_UNAVAILABLE);
      expect(await statusOf(page, written)).toBe(RECEIPT_STATUS.Pending);

      // ── Không ký số: exported, kept, locked ───────────────────────────────
      const issued = await exportAs(page, written, SIGN_MODE.Unsigned);
      expect(issued.status, JSON.stringify(issued.body)).toBe(200);
      expect(issued.body.status).toBe(RECEIPT_STATUS.Issued);
    });

    // A separate read: exported Không ký số with its file, and the session it was signed in is closed.
    const exported = await receiptRead(page, written);
    expect(exported.status).toBe(RECEIPT_STATUS.Issued);
    expect(exported.signMode).toBe(SIGN_MODE.Unsigned);
    expect(exported.hasFile).toBe(true);
    const signing = await call(page, `/api/v1/app/receipt-signing/${written.id}`);
    expect(signing.status, JSON.stringify(signing.body)).toBe(200);
    expect((signing.body.session as { isOpen?: boolean } | null)?.isOpen ?? false).toBe(false);

    // ── The stored file: a PDF/A, read back the same each time ──────────────
    const first = await receiptFile(page, written);
    expect(first.status()).toBe(200);
    expect(first.headers()["content-type"]).toContain("application/pdf");
    const pdf = await first.body();
    expect(pdf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    expect(pdf.toString("latin1")).toContain("pdfaid:part");
    const again = await (await receiptFile(page, written)).body();
    expect(again.equals(pdf), "the file is written once, not rendered per read").toBe(true);

    // ── Written once: a second export is refused ────────────────────────────
    const twice = await exportAs(page, written, SIGN_MODE.Unsigned);
    expect(twice.status, JSON.stringify(twice.body)).toBe(403);
    expect(errorCode(twice.body)).toBe(LOCKED);
  });

  test("another branch can neither export nor read the stored receipt", async ({ page, browser }) => {
    expect(receipt).not.toBeNull();
    const own = receipt!;
    const context = await browser.newContext();
    try {
      const other = await context.newPage();
      await login(other, BRANCH2_USER);
      const exported = await exportAs(other, own, SIGN_MODE.Unsigned);
      expect(exported.status, JSON.stringify(exported.body)).toBeGreaterThanOrEqual(400);
      expect(exported.status).toBeLessThan(500);
      const read = await receiptFile(other, own);
      expect(read.status()).toBeGreaterThanOrEqual(400);
      expect(read.status()).toBeLessThan(500);
      expect((await read.body()).subarray(0, 5).toString("latin1")).not.toBe("%PDF-");
    } finally {
      await context.close();
    }

    // Its own branch still reads it.
    await login(page);
    expect((await receiptFile(page, own)).status()).toBe(200);
  });
});
