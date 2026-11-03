import { expect, request, test, type Page } from "@playwright/test";
import { BRANCH2_USER, login } from "./fixtures/auth";
import {
  call,
  expectReceiptPage,
  openNewSlip,
  PAYMENTS_API,
  RECEIPT_STATUS,
  revisionOf,
  SIGN_MODE,
  SIGNATURE_PNG,
  withPairedIpad,
  writeOnFirstLine,
  type Receipt,
} from "./fixtures/ledgerReceipt";

/**
 * P2910_02 · "In phiếu thu" for a hand signature, the accountant's Ký điện tử,
 * and the receipt log the BA asked for on "Xuất phiếu thu" (F-84, R-1081).
 *
 * In phiếu thu → Xác nhận in ends the iPad session as Printed; the customer
 * signs the printout, and the accountant exports without an iPad drawing.
 * Ký điện tử puts the accountant's saved signature above Người lập phiếu.
 * Every print, take-back, export and cancel is a line in the receipt's log:
 * when, by whom, how it was signed and by whom, and the file's SHA-256.
 * Each line is sealed to the one before (R-1082), and every read checks it.
 *
 * Real stack only: real login, real ASP.NET Core API, real PostgreSQL, real
 * MinIO and Gotenberg; every follow-up is a separate request.
 */

const SIGNING_API = "/api/v1/app/receipt-signing";
const SIGNATURE_API = "/api/v1/app/accountant-signature/mine";
const STATION_API = "/api/v1/public/signing-station";

const LOCKED = "BlueDental:Billing:0096";
const SIGNATURE_MISSING = "BlueDental:Billing:0117";
const SIGNATURE_TOO_LARGE = "BlueDental:Billing:0118";
const SIGNED_ON_PAPER = "BlueDental:Billing:0119";

/** Matches BlueDental.Billing.ReceiptLogAction. */
const LOG = { PrintedForPaper: 1, PaperTakenBack: 2, Exported: 3, Cancelled: 4 } as const;
/** SigningCloseReason.Printed / SigningStationStage.Printed. */
const PRINTED = 6;

interface LogLine {
  sequence: number;
  verified: boolean;
  action: number;
  at: string;
  userName: string | null;
  signMode: number | null;
  accountantSignerName: string | null;
  accountantSignatureSavedAt: string | null;
  customerSignedAt: string | null;
  customerSignedOnPaper: boolean | null;
  fileSha256: string | null;
  cancelReasonCode: number | null;
}

const errorCode = (body: Record<string, unknown>) => (body.error as { code?: string } | undefined)?.code ?? "";

const printForPaper = (page: Page, receipt: Pick<Receipt, "id">) =>
  call(page, `${SIGNING_API}/${receipt.id}/print-for-paper`, { method: "POST" });

const exportAs = (page: Page, receipt: Pick<Receipt, "id">, signMode: number) =>
  call(page, `${PAYMENTS_API}/${receipt.id}/export`, { method: "POST", json: { signMode } });

const saveSignature = (page: Page, signatureDataUrl: string) =>
  call(page, SIGNATURE_API, { method: "PUT", json: { signatureDataUrl, source: 1 } });

interface LogList {
  items: LogLine[];
  intact: boolean;
  unsealedCount: number;
}

/**
 * The receipt's log as a separate request. Every read also checks the seal
 * chain (R-1082): numbered 1..n, each line verified against the one before.
 */
async function logOf(page: Page, receipt: Pick<Receipt, "id">): Promise<LogLine[]> {
  const res = await page.request.get(`${SIGNING_API}/${receipt.id}/log`, { headers: { Accept: "application/json" } });
  expect(res.status(), await res.text()).toBe(200);
  const log = (await res.json()) as LogList;
  expect(log.intact, JSON.stringify(log)).toBe(true);
  expect(log.unsealedCount).toBe(0);
  expect(log.items.map((line) => line.sequence)).toEqual(log.items.map((_, i) => i + 1));
  expect(log.items.every((line) => line.verified)).toBe(true);
  return log.items;
}

async function receiptRead(page: Page, receipt: Pick<Receipt, "id">): Promise<Record<string, unknown>> {
  const read = await call(page, `${PAYMENTS_API}/${receipt.id}/receipt`);
  expect(read.status, JSON.stringify(read.body)).toBe(200);
  return read.body;
}

/** A receipt written on a fresh slip's Thanh toán tab — before any iPad is paired, so it is not auto-sent. */
async function freshReceipt(page: Page): Promise<Receipt> {
  await openNewSlip(page);
  await page.getByRole("tab", { name: "Thanh toán", exact: true }).click();
  return writeOnFirstLine(page);
}

/** A real PNG header padded past the accountant's 200 KB: the server's own cap, not a validation error. */
function oversizedPng(): string {
  const magic = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return `data:image/png;base64,${Buffer.concat([magic, Buffer.alloc(210 * 1024)]).toString("base64")}`;
}

const panel = (page: Page) => page.getByRole("complementary", { name: "Trạng thái" });

test.describe.serial("In phiếu thu để ký tay & chữ ký kế toán", () => {
  /** On paper and not exported: what the other branch is refused. */
  let onPaper: Receipt | null = null;

  test("In phiếu thu ends the iPad session as Printed; export needs no iPad drawing; each step is logged", async ({ page }) => {
    await login(page);
    const receipt = await freshReceipt(page);

    await withPairedIpad(page, receipt, async (token) => {
      const sent = await call(page, `${SIGNING_API}/${receipt.id}/send`, { method: "POST", json: { replace: true } });
      expect(sent.status, JSON.stringify(sent.body)).toBe(200);

      // ── Xác nhận in: the session closes as Printed ────────────────────────
      const printed = await printForPaper(page, receipt);
      expect(printed.status, JSON.stringify(printed.body)).toBe(200);
      const session = printed.body.session as { isOpen: boolean; closeReason: number | null };
      expect(session.isOpen).toBe(false);
      expect(session.closeReason).toBe(PRINTED);

      // The iPad, on its own token, shows "Cảm ơn quý khách" for the printed receipt.
      const ipad = await request.newContext({ baseURL: new URL(page.url()).origin });
      try {
        const station = await ipad.get(STATION_API, {
          headers: { "X-Signing-Device-Token": token, Accept: "application/json" },
        });
        expect(station.status(), await station.text()).toBe(200);
        const shown = (await station.json()) as { stage: number; paymentCode: string | null; paperSignedAt: string | null };
        expect(shown.stage).toBe(PRINTED);
        expect(shown.paymentCode).toBe(receipt.code);
        expect(shown.paperSignedAt).toBeTruthy();
      } finally {
        await ipad.dispose();
      }

      // ── On paper: the iPad is not offered again ───────────────────────────
      const resend = await call(page, `${SIGNING_API}/${receipt.id}/send`, { method: "POST", json: { replace: true } });
      expect(resend.status, JSON.stringify(resend.body)).toBe(403);
      expect(errorCode(resend.body)).toBe(SIGNED_ON_PAPER);
    });

    // Printing again keeps the first time and writes no second line.
    const first = await receiptRead(page, receipt);
    expect(first.paperSignedAt).toBeTruthy();
    expect(first.paperSignedByName).toBeTruthy();
    expect((await printForPaper(page, receipt)).status).toBe(200);
    expect((await receiptRead(page, receipt)).paperSignedAt).toBe(first.paperSignedAt);

    // ── Ký tay trực tiếp: exported with no drawing from the iPad ────────────
    const exported = await exportAs(page, receipt, SIGN_MODE.Unsigned);
    expect(exported.status, JSON.stringify(exported.body)).toBe(200);
    expect(exported.body.status).toBe(RECEIPT_STATUS.Issued);
    const read = await receiptRead(page, receipt);
    expect(read.signMode).toBe(SIGN_MODE.Unsigned);
    expect(read.hasFile).toBe(true);
    expect(read.accountantSignerName).toBeNull();
    // Once exported, the receipt can no longer go to paper.
    const late = await printForPaper(page, receipt);
    expect(late.status, JSON.stringify(late.body)).toBe(403);

    // ── The log: Thời gian xuất phiếu, người ký, user + timestamp ──────────
    const log = await logOf(page, receipt);
    expect(log.map((line) => line.action)).toEqual([LOG.PrintedForPaper, LOG.Exported]);
    const [print, exportLine] = log;
    expect(print.at).toBe(first.paperSignedAt);
    expect(print.userName).toBeTruthy();
    expect(exportLine.at).toBe(read.issuedAt);
    expect(exportLine.userName).toBe(read.issuedByName);
    expect(exportLine.signMode).toBe(SIGN_MODE.Unsigned);
    expect(exportLine.accountantSignerName).toBeNull();
    expect(exportLine.customerSignedOnPaper).toBe(true);
    expect(exportLine.customerSignedAt).toBe(first.paperSignedAt);
    expect(exportLine.fileSha256).toMatch(/^[0-9a-f]{64}$/);

    // ── Hủy phiếu: Thời gian hủy phiếu, by whom, why ────────────────────────
    const cancelled = await call(page, `${PAYMENTS_API}/${receipt.id}/cancel`, {
      method: "POST",
      json: { reasonCode: 1, reason: "e2e: sai người nộp" },
    });
    expect(cancelled.status, JSON.stringify(cancelled.body)).toBe(204);
    const afterCancel = await logOf(page, receipt);
    expect(afterCancel.map((line) => line.action)).toEqual([LOG.PrintedForPaper, LOG.Exported, LOG.Cancelled]);
    const cancelLine = afterCancel[2];
    expect(cancelLine.at).toBe((await receiptRead(page, receipt)).cancelledAt);
    expect(cancelLine.userName).toBeTruthy();
    expect(cancelLine.cancelReasonCode).toBe(1);
  });

  test("Hủy phiên & sửa phiếu and an edit both take the receipt back from paper, and say so in the log", async ({ page }) => {
    await login(page);
    const receipt = await freshReceipt(page);

    expect((await printForPaper(page, receipt)).status).toBe(200);
    const backFromSession = await call(page, `${SIGNING_API}/${receipt.id}/cancel`, { method: "POST" });
    expect(backFromSession.status, JSON.stringify(backFromSession.body)).toBe(200);
    expect((await receiptRead(page, receipt)).paperSignedAt).toBeNull();
    // Not signed anywhere now: the export waits for a signature again.
    expect(errorCode((await exportAs(page, receipt, SIGN_MODE.Unsigned)).body)).toBe("BlueDental:Billing:0112");

    expect((await printForPaper(page, receipt)).status).toBe(200);
    const revised = await call(page, `${PAYMENTS_API}/${receipt.id}`, { method: "PUT", json: revisionOf(receipt) });
    expect(revised.status, JSON.stringify(revised.body)).toBe(200);
    expect((await receiptRead(page, receipt)).paperSignedAt).toBeNull();

    // Printed once more, and left on paper for the branch test.
    expect((await printForPaper(page, receipt)).status).toBe(200);
    const log = await logOf(page, receipt);
    expect(log.map((line) => line.action)).toEqual([
      LOG.PrintedForPaper,
      LOG.PaperTakenBack,
      LOG.PrintedForPaper,
      LOG.PaperTakenBack,
      LOG.PrintedForPaper,
    ]);
    expect(log.every((line) => line.userName)).toBe(true);
    onPaper = receipt;
  });

  test("Ký điện tử: refused with no saved signature or one over 200 KB; the saved one is on the export and in the log", async ({ page }) => {
    await login(page);
    const receipt = await freshReceipt(page);
    expect((await printForPaper(page, receipt)).status).toBe(200);

    // A user who has never saved one is told so (later runs reuse the account's signature).
    const before = await call(page, SIGNATURE_API);
    if (before.status === 204) {
      const missing = await exportAs(page, receipt, SIGN_MODE.Electronic);
      expect(missing.status, JSON.stringify(missing.body)).toBe(403);
      expect(errorCode(missing.body)).toBe(SIGNATURE_MISSING);
      expect((await receiptRead(page, receipt)).status).toBe(RECEIPT_STATUS.Pending);
    } else {
      expect(before.status, JSON.stringify(before.body)).toBe(200);
    }

    const tooLarge = await saveSignature(page, oversizedPng());
    expect(tooLarge.status, JSON.stringify(tooLarge.body)).toBe(403);
    expect(errorCode(tooLarge.body)).toBe(SIGNATURE_TOO_LARGE);

    const saved = await saveSignature(page, SIGNATURE_PNG);
    expect(saved.status, JSON.stringify(saved.body)).toBe(200);
    expect(saved.body.signatureDataUrl).toBe(SIGNATURE_PNG);
    expect(saved.body.userName).toBeTruthy();
    // A separate read gives the same picture back — kept encrypted, opened for its owner only.
    const mine = await call(page, SIGNATURE_API);
    expect(mine.status).toBe(200);
    expect(mine.body.signatureDataUrl).toBe(SIGNATURE_PNG);
    // The PUT echoes .NET ticks; PostgreSQL keeps microseconds — the same instant.
    expect(Date.parse(String(mine.body.savedAt))).toBe(Date.parse(String(saved.body.savedAt)));
    const savedAt = mine.body.savedAt;

    const exported = await exportAs(page, receipt, SIGN_MODE.Electronic);
    expect(exported.status, JSON.stringify(exported.body)).toBe(200);
    expect(exported.body.status).toBe(RECEIPT_STATUS.Issued);
    const read = await receiptRead(page, receipt);
    expect(read.signMode).toBe(SIGN_MODE.Electronic);
    expect(read.accountantSignerName).toBe(saved.body.userName);
    expect(read.accountantSignatureSavedAt).toBe(savedAt);

    const exportLine = (await logOf(page, receipt)).find((line) => line.action === LOG.Exported);
    expect(exportLine?.signMode).toBe(SIGN_MODE.Electronic);
    expect(exportLine?.accountantSignerName).toBe(saved.body.userName);
    expect(exportLine?.accountantSignatureSavedAt).toBe(savedAt);
    expect(exportLine?.fileSha256).toMatch(/^[0-9a-f]{64}$/);

    // Written once.
    expect(errorCode((await exportAs(page, receipt, SIGN_MODE.Electronic)).body)).toBe(LOCKED);
  });

  test("another branch can neither print the receipt nor read its log, nor see this user's signature", async ({ page, browser }) => {
    expect(onPaper).not.toBeNull();
    const own = onPaper!;
    const context = await browser.newContext();
    try {
      const other = await context.newPage();
      await login(other, BRANCH2_USER);
      const printed = await printForPaper(other, own);
      expect(printed.status, JSON.stringify(printed.body)).toBeGreaterThanOrEqual(400);
      expect(printed.status).toBeLessThan(500);
      const log = await other.request.get(`${SIGNING_API}/${own.id}/log`, { headers: { Accept: "application/json" } });
      expect(log.status()).toBeGreaterThanOrEqual(400);
      expect(log.status()).toBeLessThan(500);
      // "mine" is the caller's own: never another user's picture.
      const mine = await call(other, SIGNATURE_API);
      expect(mine.body.signatureDataUrl ?? null).not.toBe(SIGNATURE_PNG);
    } finally {
      await context.close();
    }

    // Its own branch still reads the log, unchanged by the refusals.
    await login(page);
    expect((await logOf(page, own)).map((line) => line.action).at(-1)).toBe(LOG.PrintedForPaper);
  });

  test("on screen: In phiếu thu asks first, the steps read Ký tay trên giấy, and Ký điện tử signs and exports", async ({ page }) => {
    await login(page);
    const receipt = await freshReceipt(page);
    await page.goto(`/billing/receipts/${receipt.id}`);
    await expectReceiptPage(page, receipt);

    // ── The question first; Hủy leaves the receipt as it was ────────────────
    await panel(page).getByRole("button", { name: "In phiếu thu" }).click();
    const question = page.getByRole("dialog");
    await expect(question.getByRole("heading", { name: "In phiếu thu để ký tay?" })).toBeVisible();
    await expect(question).toContainText("ký tay trực tiếp tại quầy");
    await question.getByRole("button", { name: "Hủy" }).click();
    await expect(question).toBeHidden();
    expect((await receiptRead(page, receipt)).paperSignedAt).toBeNull();

    // ── Xác nhận in: the receipt goes to paper, no draft tab (R-1101) ──────
    await panel(page).getByRole("button", { name: "In phiếu thu" }).click();
    const printed = page.waitForResponse(
      (res) => res.url().endsWith(`${SIGNING_API}/${receipt.id}/print-for-paper`) && res.request().method() === "POST",
    );
    const tabs: Page[] = [];
    const countTab = (tab: Page) => tabs.push(tab);
    page.on("popup", countTab);
    await page.getByRole("dialog").getByRole("button", { name: "Xác nhận in" }).click();
    expect((await printed).ok()).toBe(true);
    await expect(page.getByText("Đã chuyển sang ký tay trên phiếu in")).toBeVisible();
    await expect(page.getByRole("dialog")).toBeHidden();

    await expect(panel(page).locator(".rcpt-panel-title")).toHaveText("Khách ký tay trên phiếu in");
    await expect(panel(page).locator(".rcpt-signed-chip")).toHaveText(/^Lúc \d{2}:\d{2}:\d{2}$/);
    await expect(panel(page).getByRole("button", { name: "In phiếu thu" })).toHaveCount(0);
    await expect(panel(page).getByRole("button", { name: "Gửi tới iPad" })).toHaveCount(0);
    await expect(panel(page).getByRole("button", { name: "Hủy phiên & sửa phiếu" })).toBeVisible();

    // Steps 2–4 were done by hand at the counter; Kế toán kiểm tra is next.
    const steps = page.locator(".rcpt-track-card .step-track-item");
    for (const index of [1, 2, 3]) {
      await expect(steps.nth(index)).toContainText(/Ký tay trên giấy · \d{2}:\d{2}:\d{2}/);
      await expect(steps.nth(index)).toHaveClass(/step-track-item--done/);
    }
    await expect(steps.nth(4)).toHaveClass(/step-track-item--current/);
    page.off("popup", countTab);
    expect(tabs).toHaveLength(0);

    // ── Ký điện tử by default, beside Token điện tử and Ký tay trực tiếp ────
    const modes = panel(page).getByRole("radiogroup");
    await expect(modes.getByRole("radio")).toHaveCount(3);
    await expect(modes.getByRole("radio", { name: "Ký điện tử" })).toBeChecked();
    await expect(modes.getByRole("radio", { name: "Token điện tử" })).toBeEnabled();
    await expect(modes.getByRole("radio", { name: "Ký tay trực tiếp" })).toBeEnabled();
    const exportButton = panel(page).locator(".rcpt-panel-actions").getByRole("button", { name: "Xuất phiếu thu" });

    // Ký lại over the signature the previous test saved: draw on the pad, Lưu chữ ký.
    await panel(page).getByRole("button", { name: "Ký lại" }).click();
    await expect(exportButton).toBeDisabled();
    const pad = panel(page).getByLabel("Ô ký của kế toán");
    const box = (await pad.boundingBox())!;
    await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.6);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.3, { steps: 8 });
    await page.mouse.move(box.x + box.width * 0.8, box.y + box.height * 0.6, { steps: 8 });
    await page.mouse.up();
    const stored = page.waitForResponse((res) => res.url().endsWith(SIGNATURE_API) && res.request().method() === "PUT");
    await panel(page).getByRole("button", { name: "Lưu chữ ký" }).click();
    expect((await stored).ok()).toBe(true);
    await expect(panel(page).getByRole("img", { name: "Chữ ký kế toán" })).toBeVisible();
    await expect(panel(page).locator(".rcpt-acsign-owner")).toHaveText(/^Chữ ký của .+ · lưu \d{2}\/\d{2}\/\d{4}$/);
    const drawn = await call(page, SIGNATURE_API);
    expect(drawn.body.signatureDataUrl).not.toBe(SIGNATURE_PNG);

    // ── Xuất phiếu thu: the stored file opens; the log names the signer ─────
    await expect(exportButton).toBeEnabled();
    const file = page.waitForResponse((res) => res.url().includes(`/${receipt.id}/receipt-file`) && res.ok());
    const exportTab = page.waitForEvent("popup");
    await exportButton.click();
    expect((await (await file).body()).subarray(0, 5).toString("latin1")).toBe("%PDF-");
    await (await exportTab).close();

    await page.reload();
    await expect(page.locator(".rcpt-track-card .step-track-item--done")).toHaveCount(6);
    const exportLine = (await logOf(page, receipt)).find((line) => line.action === LOG.Exported);
    expect(exportLine?.signMode).toBe(SIGN_MODE.Electronic);
    expect(exportLine?.accountantSignatureSavedAt).toBe(drawn.body.savedAt);
    expect(exportLine?.customerSignedOnPaper).toBe(true);
  });

  test("Back from an export: the slip's Thanh toán tab reads Đã xuất phiếu thu and offers ✓ without F5", async ({ page }) => {
    await login(page);
    // The tab has listed the receipt as Chưa thanh toán, so that list is cached.
    const receipt = await freshReceipt(page);
    const row = page.getByRole("row").filter({ hasText: receipt.code });
    await expect(row.getByText("Chưa thanh toán")).toBeVisible();

    // In the same tab, no reload: open it, sign on paper, export Ký tay trực tiếp.
    await row.getByRole("button", { name: receipt.code, exact: true }).click();
    await expectReceiptPage(page, receipt);
    await panel(page).getByRole("button", { name: "In phiếu thu" }).click();
    const question = page.getByRole("dialog");
    await expect(question.getByRole("heading", { name: "In phiếu thu để ký tay?" })).toBeVisible();
    const printed = page.waitForResponse(
      (res) => res.url().endsWith(`${SIGNING_API}/${receipt.id}/print-for-paper`) && res.request().method() === "POST",
    );
    await question.getByRole("button", { name: "Xác nhận in" }).click();
    const printedRes = await printed;
    expect(printedRes.ok(), await printedRes.text()).toBe(true);
    await expect(question).toBeHidden();
    await panel(page).getByRole("radiogroup").getByRole("radio", { name: "Ký tay trực tiếp" }).check();
    const exportTab = page.waitForEvent("popup");
    await panel(page).locator(".rcpt-panel-actions").getByRole("button", { name: "Xuất phiếu thu" }).click();
    await (await exportTab).close();
    await expect(page.locator(".rcpt-track-card .step-track-item--done")).toHaveCount(6);

    await page.goBack();
    await expect(row.getByText("Đã xuất phiếu thu")).toBeVisible();
    await expect(row.getByRole("button", { name: `Xác nhận thanh toán phiếu ${receipt.code}` })).toBeVisible();
  });
});
