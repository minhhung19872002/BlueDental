import { expect, test, type Browser, type BrowserContext, type Page, type Response } from "@playwright/test";
import { BRANCH2_USER, login, runId } from "./fixtures/auth";
import { workingBranchId } from "./fixtures/branch";
import {
  call,
  expectReceiptPage,
  openNewSlip,
  writeOnFirstLine,
  type Receipt,
} from "./fixtures/ledgerReceipt";

/**
 * P2610 phase 4 · the counter iPad (`/sign`).
 *
 * Cài đặt → Kết nối iPad gives a one-time link; the iPad opened on it shows
 * the receipt the cashier sends, the customer ticks the two boxes and signs on
 * the pad, and the receipt page on the PC follows each step live, with the
 * signature on the payer's box.
 *
 * Real stack only: real login on the PC, the iPad paired through the link the
 * settings screen printed (no token planted by hand), real ASP.NET Core API +
 * SignalR, real PostgreSQL; every follow-up is a reload or a separate request.
 */

const SIGNING_API = "/api/v1/app/receipt-signing";
const DEVICES_API = "/api/v1/app/signing-devices";
const DEVICE_NAME = `iPad e2e ${runId()}`;
const IPAD_VIEWPORT = { width: 1024, height: 1366 };

let pairingLink = "";
/** Receipts each test wrote; their sessions are ended after it, pass or fail. */
const written: Receipt[] = [];

interface SessionRead {
  hasDevice: boolean;
  busyWithCode: string | null;
  session: { isOpen: boolean; sentAt: string | null; checkedAt: string | null; signedAt: string | null; signatureDataUrl: string | null } | null;
}

async function signingState(page: Page, receipt: Pick<Receipt, "id">): Promise<SessionRead> {
  const read = await call(page, `${SIGNING_API}/${receipt.id}`);
  expect(read.status, JSON.stringify(read.body)).toBe(200);
  return read.body as unknown as SessionRead;
}

/**
 * A fresh iPad browser, paired by opening the link from Cài đặt. It shows the
 * branch's open session if there is one (a failed earlier run may have left it).
 */
async function openIpad(browser: Browser): Promise<{ context: BrowserContext; ipad: Page }> {
  expect(pairingLink, "paired in the first test").toMatch(/\/sign\/pair#.+/);
  const context = await browser.newContext({ viewport: IPAD_VIEWPORT, hasTouch: true });
  const ipad = await context.newPage();
  await ipad.goto(pairingLink);
  await expect(ipad).toHaveURL(/\/sign$/);
  await expect(ipad.locator(".sst-head-name")).not.toBeEmpty({ timeout: 20_000 });
  return { context, ipad };
}

/** A receipt written on a fresh slip, its page open on the PC. */
async function receiptOnPage(page: Page): Promise<Receipt> {
  const { slip } = await openNewSlip(page);
  await page.getByRole("tab", { name: "Thanh toán", exact: true }).click();
  const receipt = await writeOnFirstLine(page);
  written.push(receipt);
  await page.goto(`/billing/receipts/${receipt.id}`);
  await expectReceiptPage(page, receipt);
  expect(receipt.treatmentPlanId).toBe(slip.id);
  return receipt;
}

const panel = (page: Page) => page.getByRole("complementary", { name: "Trạng thái" });

/** The stored PHIẾU THU read back for the receipt's tab. */
const storedReceiptFile = (page: Page, receipt: Pick<Receipt, "id">) =>
  page.waitForResponse((res) => res.url().includes(`/${receipt.id}/receipt-file`) && res.ok());

async function expectPdf(res: Response): Promise<void> {
  expect(res.headers()["content-type"]).toContain("application/pdf");
  expect((await res.body()).subarray(0, 5).toString("latin1")).toBe("%PDF-");
}
const ipadStatus = (page: Page) => panel(page).locator(".rcpt-ipad-status");

/**
 * A new receipt goes straight to a free iPad (no click). If an earlier, failed
 * run left another receipt waiting there, end that session and send this one.
 */
async function expectAutoSent(page: Page): Promise<void> {
  const replace = panel(page).getByRole("button", { name: "Hủy phiên đang chờ & gửi phiếu này" });
  const sent = ipadStatus(page).getByText("iPad đang hiển thị phiếu, khách đang kiểm tra", { exact: true });
  await expect(replace.or(sent)).toBeVisible({ timeout: 20_000 });
  if (await replace.isVisible()) {
    await replace.click();
    await page.getByRole("dialog").getByRole("button", { name: "Hủy & gửi" }).click();
    await expect(page.getByText("Đã gửi phiếu tới iPad")).toBeVisible();
  }
  await expect(sent).toBeVisible();
  await expect(panel(page).getByRole("button", { name: "Gửi lại" })).toBeVisible();
}

/** Both boxes, then "Xác nhận thông tin". */
async function confirmOnIpad(ipad: Page, receipt: Pick<Receipt, "code">): Promise<void> {
  await expect(ipad.locator(".rcpt-sheet")).toContainText(receipt.code, { timeout: 20_000 });
  const confirm = ipad.getByRole("button", { name: "Xác nhận thông tin" });
  await expect(confirm).toBeDisabled();
  await ipad.getByRole("checkbox").nth(0).check();
  await expect(confirm).toBeDisabled();
  await ipad.getByRole("checkbox").nth(1).check();
  await confirm.click();
}

/** A stroke across the pad, then "Hoàn tất ký". */
async function signOnIpad(ipad: Page): Promise<void> {
  await expect(ipad.getByRole("heading", { name: "Ký tên xác nhận" })).toBeVisible();
  const finish = ipad.getByRole("button", { name: "Hoàn tất ký" });
  await expect(finish).toBeDisabled();
  const box = await ipad.locator(".sst-pad-canvas").boundingBox();
  expect(box).not.toBeNull();
  const { x, y, width, height } = box!;
  await ipad.mouse.move(x + width * 0.2, y + height * 0.6);
  await ipad.mouse.down();
  for (let step = 1; step <= 12; step += 1) {
    await ipad.mouse.move(x + width * (0.2 + step * 0.05), y + height * (0.6 - (step % 2) * 0.15));
  }
  await ipad.mouse.up();
  await expect(finish).toBeEnabled();
  await finish.click();
  await expect(ipad.getByRole("heading", { name: "Cảm ơn quý khách đã ký" })).toBeVisible();
  await expect(ipad.getByText("Đang chờ kế toán xác nhận")).toBeVisible();
}

async function expectPcSteps(page: Page, done: number, current: string): Promise<void> {
  await expect(page.locator(".rcpt-track-card .step-track-item--done")).toHaveCount(done);
  await expect(page.locator(".rcpt-track-card .step-track-item--current .step-track-label")).toHaveText(current);
  // Each step done carries its time, not the "—" of a step still ahead.
  const captions = page.locator(".rcpt-track-card .step-track-item--done .step-track-caption");
  for (let index = 0; index < done; index += 1) await expect(captions.nth(index)).toHaveText(/^\d{2}:\d{2}/);
}

test.describe.serial("iPad ký phiếu thu", () => {
  test.setTimeout(150_000);

  // An open session would hold the branch's iPad for the next run.
  test.afterEach(async ({ page }) => {
    for (const receipt of written.splice(0)) {
      await call(page, `${SIGNING_API}/${receipt.id}/cancel`, { method: "POST" }).catch(() => undefined);
    }
  });

  // A paired iPad makes every new receipt of the branch go to it; leave none
  // behind for the other specs, even when this run stopped half way.
  test.afterAll(async ({ browser }) => {
    const context = await browser.newContext();
    try {
      const page = await context.newPage();
      await login(page);
      const list = await call(page, `${DEVICES_API}?clinicBranchId=${await branchOf(page)}`);
      const devices = (Array.isArray(list.body) ? list.body : []) as { id: string; name: string; isActive: boolean }[];
      for (const device of devices.filter((d) => d.isActive && d.name.startsWith("iPad e2e "))) {
        await call(page, `${DEVICES_API}/${device.id}/revoke`, { method: "POST" });
      }
    } finally {
      await context.close();
    }
  });

  test("Cài đặt → Kết nối iPad prints a one-time link; the iPad opened on it waits", async ({ page, browser }) => {
    await login(page);
    await page.goto("/settings?tab=ipad");
    await expect(page.locator(".profile-content-title")).toHaveText("Kết nối iPad");
    await page.getByRole("textbox", { name: "Tên iPad" }).fill(DEVICE_NAME);
    await page.getByRole("button", { name: "Tạo đường dẫn kết nối" }).click();

    const link = page.getByRole("region", { name: "Đường dẫn kết nối iPad" });
    await expect(link.locator(".ant-qrcode canvas")).toBeVisible();
    await expect(link).toContainText("Đường dẫn chỉ hiện một lần");
    pairingLink = await link.getByRole("textbox").inputValue();
    // The token rides after "#", so it never reaches the server's access log.
    // The link names the address staff opened, whatever host E2E_BASE_URL points at.
    const origin = new URL(page.url()).origin.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    expect(pairingLink).toMatch(new RegExp(`^${origin}/sign/pair#[A-Za-z0-9_-]{20,}$`));

    // The list, read again after a reload: the new iPad, paired, not yet seen.
    await page.reload();
    const row = page.locator(".ant-table-row", { hasText: DEVICE_NAME });
    await expect(row).toContainText("Đang kết nối");
    await expect(page.getByRole("region", { name: "Đường dẫn kết nối iPad" })).toHaveCount(0);

    const { context, ipad } = await openIpad(browser);
    try {
      // No staff login on the iPad: a reload stays on /sign, never /login.
      await ipad.reload();
      await expect(ipad).toHaveURL(/\/sign$/);
      await expect(ipad.locator(".sst-head-name")).not.toBeEmpty({ timeout: 20_000 });
    } finally {
      await context.close();
    }
    await page.reload();
    await expect(row).not.toContainText("—");
  });

  test("the customer checks and signs on the iPad; the PC shows each step and the signature", async ({ page, browser }) => {
    await login(page);
    const { context, ipad } = await openIpad(browser);
    try {
      const receipt = await receiptOnPage(page);
      await expectAutoSent(page);
      await expect(panel(page).locator(".rcpt-panel-title")).toHaveText("Khách đang kiểm tra trên iPad");
      await expectPcSteps(page, 2, "Khách kiểm tra");

      // ── The iPad: sheet, the four steps, both boxes ─────────────────────────
      await expect(ipad.locator(".sst-steps")).toContainText("Kiểm tra phiếu thu");
      await confirmOnIpad(ipad, receipt);
      await expect(ipadStatus(page)).toHaveText("Khách đã xác nhận thông tin, đang ký");
      await expectPcSteps(page, 3, "Khách đồng ý & ký");

      await signOnIpad(ipad);

      // ── The PC, live: signed, the signature and its time on the payer box ───
      await expect(ipadStatus(page)).toHaveText(/^Khách đã ký lúc \d{2}:\d{2}/);
      await expect(panel(page).locator(".rcpt-panel-title")).toHaveText("Khách đã ký");
      await expect(page.locator(".rcpt-sheet .rcpt-sign-image")).toBeVisible();
      await expect(page.locator(".rcpt-sheet .rcpt-sign-time")).toHaveText(/^Ký lúc \d{2}\/\d{2}\/\d{4}/);
      await expectPcSteps(page, 4, "Kế toán kiểm tra");
      // Signed, waiting on the export: no Gửi lại, no In phiếu thu (BA mock).
      await expect(panel(page).getByRole("button", { name: "Gửi lại" })).toHaveCount(0);
      await expect(panel(page).getByRole("button", { name: "In phiếu thu" })).toHaveCount(0);

      // A separate read: the signature was kept (stored encrypted, read back decrypted).
      const signed = await signingState(page, receipt);
      expect(signed.session?.isOpen).toBe(true);
      expect(signed.session?.signedAt).not.toBeNull();
      expect(signed.session?.signatureDataUrl).toMatch(/^data:image\/png;base64,/);
      await page.reload();
      await expect(page.locator(".rcpt-sheet .rcpt-sign-image")).toBeVisible();

      // ── "Yêu cầu khách ký lại": the pad again, no second check ──────────────
      await panel(page).getByRole("button", { name: "Yêu cầu khách ký lại" }).click();
      await expect(page.getByText("Đã xóa chữ ký, iPad chờ khách ký lại")).toBeVisible();
      await expect(page.locator(".rcpt-sheet .rcpt-sign-image")).toHaveCount(0);
      await signOnIpad(ipad);
      await expect(page.locator(".rcpt-sheet .rcpt-sign-image")).toBeVisible();

      // ── "Kế toán kiểm tra & xuất": nothing picked for the accountant, Ký số not yet ──
      const exportPanel = panel(page).locator(".rcpt-export");
      await expect(exportPanel).toContainText("Kế toán kiểm tra & xuất phiếu thu");
      // The button sits in the foot row beside Yêu cầu khách ký lại; Hủy phiên drops below (BA mock).
      const exportButton = panel(page).locator(".rcpt-panel-actions").getByRole("button", { name: "Xuất phiếu thu" });
      await expect(exportButton).toBeDisabled();
      const rowOf = async (name: string) =>
        (await panel(page).getByRole("button", { name }).boundingBox())?.y ?? Number.NaN;
      await expect.poll(async () => (await rowOf("Xuất phiếu thu")) - (await rowOf("Yêu cầu khách ký lại"))).toBe(0);
      expect(await rowOf("Hủy phiên & sửa phiếu")).toBeGreaterThan(await rowOf("Xuất phiếu thu"));
      await expect(exportPanel).toContainText("Chọn hình thức ký trước khi xuất.");
      await expect(exportPanel.getByRole("radio", { name: /^Ký số/ })).toBeDisabled();
      await exportPanel.getByRole("radio", { name: "Không ký số" }).check();
      await expect(exportButton).toBeEnabled();

      // ── Exported: the stored PDF opens in a new tab, the iPad says so, then waits again ──
      const stored = storedReceiptFile(page, receipt);
      const tab = page.waitForEvent("popup");
      await exportButton.click();
      await expectPdf(await stored);
      await (await tab).close();
      await expect(exportPanel).toHaveCount(0);
      await expect(ipad.getByRole("heading", { name: "Đã xuất phiếu thu" })).toBeVisible({ timeout: 20_000 });
      await expect(ipad.locator(".sst-issued-box")).toContainText("Phiếu thu có chữ ký của quý khách");
      await expect(ipad.getByRole("heading", { name: "Xin chào quý khách" })).toBeVisible({ timeout: 30_000 });

      await page.reload();
      await expect(page.locator(".rcpt-track-card .step-track-item--done")).toHaveCount(6);
      await expect(page.locator(".rcpt-sheet .rcpt-sign-image")).toBeVisible();

      // "In phiếu" now prints the file written at export, not a fresh render.
      const reprinted = storedReceiptFile(page, receipt);
      const reprintTab = page.waitForEvent("popup");
      await panel(page).getByRole("button", { name: "In phiếu", exact: true }).click();
      await expectPdf(await reprinted);
      await (await reprintTab).close();
    } finally {
      await context.close();
    }
  });

  test("Hủy phiên ends the iPad's session; a busy iPad can be taken over for another receipt", async ({ page, browser }) => {
    await login(page);
    const { context, ipad } = await openIpad(browser);
    try {
      const first = await receiptOnPage(page);
      await expectAutoSent(page);
      await expect(ipad.locator(".rcpt-sheet")).toContainText(first.code, { timeout: 20_000 });

      // A second receipt while the iPad shows the first one.
      const second = await receiptOnPage(page);
      await expect(ipadStatus(page)).toHaveText(`iPad đang chờ khách ký phiếu ${first.code}`);
      await expect(panel(page).getByRole("button", { name: "Gửi tới iPad" })).toHaveCount(0);
      await panel(page).getByRole("button", { name: "Hủy phiên đang chờ & gửi phiếu này" }).click();
      const question = page.getByRole("dialog");
      await expect(question).toContainText(first.code);
      await question.getByRole("button", { name: "Hủy & gửi" }).click();
      await expect(ipad.locator(".rcpt-sheet")).toContainText(second.code, { timeout: 20_000 });
      expect((await signingState(page, first)).session?.isOpen).toBe(false);

      // "Hủy phiên & sửa phiếu": the iPad waits, the PC may send again.
      await panel(page).getByRole("button", { name: "Hủy phiên & sửa phiếu" }).click();
      await expect(page.getByText("Đã hủy phiên trên iPad")).toBeVisible();
      await expect(ipad.getByRole("heading", { name: "Xin chào quý khách" })).toBeVisible({ timeout: 20_000 });
      await page.reload();
      await expect(ipadStatus(page)).toHaveText("Chưa gửi tới iPad");

      // "Gửi tới iPad" by hand: the same receipt is back on the iPad.
      await panel(page).getByRole("button", { name: "Gửi tới iPad" }).click();
      await expect(page.getByText("Đã gửi phiếu tới iPad")).toBeVisible();
      await expect(ipad.locator(".rcpt-sheet")).toContainText(second.code, { timeout: 20_000 });
      await panel(page).getByRole("button", { name: "Hủy phiên & sửa phiếu" }).click();
      await expect(ipad.getByRole("heading", { name: "Xin chào quý khách" })).toBeVisible({ timeout: 20_000 });
    } finally {
      await context.close();
    }
  });

  test("the customer asks for an invoice on the iPad; it reaches the patient's requests", async ({ page, browser }) => {
    await login(page);
    const { context, ipad } = await openIpad(browser);
    try {
      const receipt = await receiptOnPage(page);
      await expectAutoSent(page);
      await expect(ipad.locator(".rcpt-sheet")).toContainText(receipt.code, { timeout: 20_000 });

      await ipad.getByRole("button", { name: "Yêu cầu xuất hóa đơn" }).click();
      await expect(ipad.getByRole("heading", { name: "Thông tin xuất hóa đơn" })).toBeVisible();
      await ipad.getByText("Cá nhân", { exact: true }).click();
      // Required fields are checked on the iPad before anything is sent.
      await ipad.getByRole("button", { name: "Lưu" }).click();
      await expect(ipad.locator(".ant-form-item-explain-error").first()).toBeVisible();

      const buyer = `Khách iPad ${runId()}`;
      await ipad.getByLabel("Họ và tên").fill(buyer);
      await ipad.getByLabel("Số điện thoại").fill("0901234567");
      await ipad.getByLabel("Số CCCD").fill("079123456789");
      await ipad.getByRole("button", { name: "Lưu" }).click();
      await expect(ipad.getByText("Đã gửi thông tin xuất hóa đơn")).toBeVisible();

      const list = await call(page, `/api/v1/app/invoice-requests?patientId=${receipt.patientId}&skipCount=0&maxResultCount=50`);
      expect(list.status, JSON.stringify(list.body)).toBe(200);
      const items = list.body.items as { patientPaymentId: string; fullName: string; source: number; isCompany: boolean }[];
      const sent = items.find((item) => item.patientPaymentId === receipt.id);
      expect(sent, "the request from the iPad").toBeTruthy();
      expect(sent!.source).toBe(3);
      expect(sent!.fullName).toBe(buyer);
      expect(sent!.isCompany).toBe(false);

      await panel(page).getByRole("button", { name: "Hủy phiên & sửa phiếu" }).click();
      await expect(ipad.getByRole("heading", { name: "Xin chào quý khách" })).toBeVisible({ timeout: 20_000 });
    } finally {
      await context.close();
    }
  });

  test("the station API takes only a paired token, and a signature only after the check", async ({ page, request }) => {
    const station = "/api/v1/public/signing-station";
    const token = pairingLink.split("#")[1];
    const asIpad = (key: string) => ({ headers: { "X-Signing-Device-Token": key, Accept: "application/json" } });
    const codeOf = async (res: { json: () => Promise<unknown> }) =>
      ((await res.json()) as { error?: { code?: string } }).error?.code;

    // Never 401: that would send the iPad to the staff login.
    const bare = await request.get(station, { headers: { Accept: "application/json" } });
    expect(bare.status()).toBe(403);
    expect(await codeOf(bare)).toBe("BlueDental:Billing:0111");
    const forged = await request.get(station, asIpad(`${token.slice(0, -4)}xxxx`));
    expect(forged.status()).toBe(403);
    expect(await codeOf(forged)).toBe("BlueDental:Billing:0111");

    await login(page);
    const receipt = await receiptOnPage(page);
    await expectAutoSent(page);
    const current = await request.get(station, asIpad(token));
    expect(current.status()).toBe(200);
    const shown = (await current.json()) as { stage: number; sessionId: string; paymentCode: string };
    expect(shown).toMatchObject({ stage: 2, paymentCode: receipt.code });

    const png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
    const sign = (body: unknown) => request.post(`${station}/sessions/${shown.sessionId}/sign`, { ...asIpad(token), data: body });
    const early = await sign({ signatureDataUrl: png });
    expect(early.status()).toBe(403);
    expect(await codeOf(early)).toBe("BlueDental:Billing:0104");

    const check = await request.post(`${station}/sessions/${shown.sessionId}/check`, asIpad(token));
    expect(check.status()).toBe(200);
    const notImage = await sign({ signatureDataUrl: "data:text/html;base64,PHNjcmlwdD4=" });
    expect(notImage.status()).toBe(403);
    expect(await codeOf(notImage)).toBe("BlueDental:Billing:0105");
    expect((await signingState(page, receipt)).session?.signedAt).toBeNull();

    // A session the cashier ended takes nothing more.
    await call(page, `${SIGNING_API}/${receipt.id}/cancel`, { method: "POST" });
    const late = await sign({ signatureDataUrl: png });
    expect(late.status()).toBe(403);
    expect(await codeOf(late)).toBe("BlueDental:Billing:0103");
  });

  test("another branch cannot list this branch's iPads; Thu hồi locks the iPad out", async ({ page, browser }) => {
    await login(page);
    const branch = await branchOf(page);
    const own = await call(page, `${DEVICES_API}?clinicBranchId=${branch}`);
    expect(own.status, JSON.stringify(own.body)).toBe(200);

    const other = await browser.newContext();
    try {
      const stranger = await other.newPage();
      await login(stranger, BRANCH2_USER);
      const read = await call(stranger, `${DEVICES_API}?clinicBranchId=${branch}`);
      expect(read.status).toBeGreaterThanOrEqual(400);
      expect(read.status).toBeLessThan(500);
    } finally {
      await other.close();
    }

    const { context, ipad } = await openIpad(browser);
    try {
      await page.goto("/settings?tab=ipad");
      const row = page.locator(".ant-table-row", { hasText: DEVICE_NAME });
      await row.getByRole("button", { name: "Thu hồi" }).click();
      const question = page.getByRole("dialog");
      await expect(question).toContainText(DEVICE_NAME);
      await question.getByRole("button", { name: "Thu hồi" }).click();
      await expect(page.getByText("Đã thu hồi kết nối iPad")).toBeVisible();
      await page.reload();
      await expect(row).toContainText("Đã thu hồi");
      await expect(row.getByRole("button", { name: "Thu hồi" })).toHaveCount(0);

      // The iPad's next read is refused, and it says how to pair again — no /login.
      await ipad.reload();
      await expect(ipad.getByRole("heading", { name: "iPad chưa được kết nối" })).toBeVisible({ timeout: 20_000 });
      await expect(ipad).toHaveURL(/\/sign$/);
    } finally {
      await context.close();
    }
  });
});

/** The branch the signed-in PC works in (the header's branch). */
async function branchOf(page: Page): Promise<string> {
  const branch = await workingBranchId(page);
  expect(branch, "a single working branch").toBeTruthy();
  return branch!;
}
