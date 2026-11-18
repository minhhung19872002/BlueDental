import { expect, test, type Page } from "@playwright/test";
import { BRANCH2_USER, login } from "./fixtures/auth";
import { PAYMENTS_API, call, collectOnFirstLine, openNewSlip, type Receipt } from "./fixtures/ledgerReceipt";

/**
 * Feature: Lưu (was Phát Hành) in the "Hóa đơn" dialog always prints the PHIẾU
 * THU (BA, 2026-10-07). The server fills `wwwroot/templates/PHIẾU THU.docx` and
 * Gotenberg (LibreOffice in Docker) turns it into a PDF; the app opens it in a
 * new tab. "Xuất hóa đơn đỏ" is never sent ticked for a receipt the server would
 * pass on — ticked, Lưu would send a real e-invoice to the provider (Chờ kiểm tra,
 * BA 2026-11-18); the one ticked send is refused by BlueDental first. Lưu Nháp
 * keeps the form in BlueDental only, so it is exercised for real.
 *
 * Real stack only: real login, real ASP.NET Core API, real PostgreSQL, real
 * Gotenberg. Nothing is intercepted.
 */

const EINVOICES = "/api/v1/app/e-invoices";
const RECEIPT_PDF = `${EINVOICES}/receipt-pdf`;
const SEARCH = "Tìm theo mã thanh toán, tên hoặc mã khách hàng...";

let receipt: Receipt | undefined;

/** The PDF bytes as the API answers them, on the signed-in session. */
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
  return { status: res.status(), type: res.headers()["content-type"] ?? "", body: await res.body() };
}

test.describe.configure({ mode: "serial", timeout: 150_000 });

test.describe("Hóa đơn → Lưu prints the PHIẾU THU", () => {
  test.afterAll(async ({ browser }) => {
    if (!receipt) return;
    const page = await browser.newPage();
    await login(page);
    await call(page, `${PAYMENTS_API}/${receipt.id}/cancel`, { method: "POST", json: { reasonCode: 4, reason: "e2e cleanup" } });
    await page.close();
  });

  test("the API renders a PDF of a fresh receipt and refuses more than it collected", async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 900 });
    await login(page);
    await openNewSlip(page);
    await page.getByRole("tab", { name: "Thanh toán", exact: true }).click();
    receipt = await collectOnFirstLine(page);

    const pdf = await renderReceipt(page, { patientPaymentId: receipt.id, lines: [] });
    expect(pdf.status, pdf.body.toString("utf8").slice(0, 300)).toBe(200);
    expect(pdf.type).toContain("application/pdf");
    expect(pdf.body.subarray(0, 5).toString("latin1")).toBe("%PDF-");

    // A line worth more than the receipt took in is the provider's cap too.
    const over = await renderReceipt(page, {
      patientPaymentId: receipt.id,
      lines: [{ code: "X", name: "Quá số đã thu", unit: "Lần", quantity: 1, unitPrice: receipt.amount * 10, vatRate: null }],
    });
    expect(over.status).toBe(403);
    expect(JSON.parse(over.body.toString("utf8")).error.code).toBe("BlueDental:EInvoicing:0010");
  });

  test("another branch cannot print this receipt", async ({ page }) => {
    expect(receipt).toBeDefined();
    await login(page, BRANCH2_USER);
    const denied = await renderReceipt(page, { patientPaymentId: receipt!.id, lines: [] });
    expect(denied.status).not.toBe(200);
    expect(denied.type).not.toContain("application/pdf");
  });

  test("Lưu opens the receipt PDF in a new tab and leaves the dialog open", async ({ page, context }) => {
    expect(receipt).toBeDefined();
    const saved = receipt!;
    await page.setViewportSize({ width: 1600, height: 900 });
    await login(page);

    await page.goto("/billing");
    await page.getByPlaceholder(SEARCH).fill(saved.code);
    const row = page.locator(".ant-table-tbody tr.ant-table-row").filter({ hasText: saved.code });
    await expect(row).toBeVisible({ timeout: 20_000 });
    await row.getByRole("button", { name: `Xuất hóa đơn điện tử cho phiếu ${saved.code}` }).click();

    const invoice = page.getByRole("dialog", { name: "Hóa đơn" });
    await expect(invoice.locator("tbody tr.ant-table-row").first()).toBeVisible({ timeout: 20_000 });
    await expect(invoice.getByRole("checkbox", { name: "Xuất hóa đơn đỏ" })).not.toBeChecked();

    const rendered = page.waitForResponse((res) => res.url().includes(RECEIPT_PDF));
    const opened = context.waitForEvent("page");
    await invoice.getByRole("button", { name: "Lưu", exact: true }).click();

    const response = await rendered;
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("application/pdf");
    // Unticked, nothing reaches EasyInvoice.
    // The tab is pointed at the PDF: a browser with a PDF viewer shows the blob
    // URL, headless Chromium (no viewer) hands the same navigation over as a
    // download of that tab.
    const tab = await opened;
    const landed = await Promise.race([
      tab.waitForEvent("download", { timeout: 20_000 }).then((download) => download.url()),
      expect.poll(() => tab.url(), { timeout: 20_000 }).toMatch(/^blob:/).then(() => tab.url()),
    ]);
    expect(landed).toMatch(/^blob:/);

    // Headless Chromium stops drawing a page left behind a popup, so close the
    // PDF and come back to the dialog as the user would.
    await tab.close();
    await page.bringToFront();
    // The dialog stays, to correct the data and print again.
    await expect(invoice).toBeVisible();
    await expect(invoice.getByRole("button", { name: "Lưu", exact: true })).toBeEnabled();
  });

  // BA 2026-10-08: ticked, Tên khách hàng, Mã số thuế, Số ĐT and Email are required;
  // Địa chỉ too, as EasyInvoice refuses a Mã số thuế without one (owner 2026-11-18).
  // Both checks stop before EasyInvoice: the dialog never sends, the server refuses first.
  test("Xuất hóa đơn đỏ requires the buyer's name, tax code, address, phone and email", async ({ page }) => {
    expect(receipt).toBeDefined();
    const saved = receipt!;
    await page.setViewportSize({ width: 1600, height: 900 });
    await login(page);

    const refused = await call(page, `${EINVOICES}/issue`, {
      method: "POST",
      json: {
        patientPaymentId: saved.id,
        send: true,
        buyerName: "E2E Buyer",
        taxCode: "0123456787",
        phone: "0900000000",
        email: "   ",
        paymentMethod: 1,
        lines: [],
      },
    });
    expect(refused.status).toBeGreaterThanOrEqual(400);
    expect(refused.body).toMatchObject({ error: { code: "BlueDental:EInvoicing:0017" } });

    await page.goto("/billing");
    await page.getByPlaceholder(SEARCH).fill(saved.code);
    const row = page.locator(".ant-table-tbody tr.ant-table-row").filter({ hasText: saved.code });
    await expect(row).toBeVisible({ timeout: 20_000 });
    await row.getByRole("button", { name: `Xuất hóa đơn điện tử cho phiếu ${saved.code}` }).click();

    const invoice = page.getByRole("dialog", { name: "Hóa đơn" });
    await expect(invoice.locator("tbody tr.ant-table-row").first()).toBeVisible({ timeout: 20_000 });
    const taxCode = invoice.getByRole("textbox", { name: /^Mã số thuế/ });
    const email = invoice.getByRole("textbox", { name: /^Email/ });
    const address = invoice.getByRole("textbox", { name: /^Địa chỉ/ });
    await taxCode.fill("");
    await email.fill("");
    await address.fill("");

    // Unticked, the blank fields are fine: no asterisk, no error.
    await expect(invoice.locator(".floating-field-required")).toHaveCount(0);

    await invoice.getByRole("checkbox", { name: "Xuất hóa đơn đỏ" }).check();
    await expect(invoice.locator(".floating-field-required")).toHaveCount(5);

    let sent = false;
    page.on("request", (req) => {
      if (req.url().includes(`${EINVOICES}/issue`) || req.url().includes(RECEIPT_PDF)) sent = true;
    });
    await invoice.getByRole("button", { name: "Lưu", exact: true }).click();
    await expect(invoice.getByText("Vui lòng nhập Mã số thuế")).toBeVisible();
    await expect(invoice.getByText("Vui lòng nhập Email")).toBeVisible();
    await expect(invoice.getByText("Vui lòng nhập Địa chỉ")).toBeVisible();
    await expect(address).toHaveAttribute("aria-invalid", "true");
    await expect(taxCode).toHaveAttribute("aria-invalid", "true");
    // No confirm, no receipt, nothing sent.
    await expect(page.getByRole("dialog", { name: /^Gửi hóa đơn/ })).toHaveCount(0);
    expect(sent).toBe(false);

    // Typing clears that field's error; unticking clears the rest.
    await taxCode.fill("0123456787");
    await expect(invoice.getByText("Vui lòng nhập Mã số thuế")).toHaveCount(0);
    await invoice.getByRole("checkbox", { name: "Xuất hóa đơn đỏ" }).uncheck();
    await expect(invoice.getByText("Vui lòng nhập Email")).toHaveCount(0);
    await expect(invoice.locator(".floating-field-required")).toHaveCount(0);
  });

  test("a Mã số thuế EasyInvoice would refuse (129) is caught under the box, before anything is sent (R-1245)", async ({ page }) => {
    expect(receipt).toBeDefined();
    const saved = receipt!;
    await page.setViewportSize({ width: 1600, height: 900 });
    await login(page);

    // The server says it too before sending, and names the box.
    const refused = await call(page, `${EINVOICES}/issue`, {
      method: "POST",
      json: {
        patientPaymentId: saved.id,
        send: true,
        buyerName: "E2E Buyer",
        taxCode: "02344444444",
        address: "1 E2E",
        phone: "0900000000",
        email: "e2e@example.com",
        paymentMethod: 1,
        lines: [],
      },
    });
    expect(refused.status).toBe(403);
    expect(refused.body).toMatchObject({ error: { code: "BlueDental:EInvoicing:0018", data: { Field: "taxCode" } } });

    await page.goto("/billing");
    await page.getByPlaceholder(SEARCH).fill(saved.code);
    const row = page.locator(".ant-table-tbody tr.ant-table-row").filter({ hasText: saved.code });
    await expect(row).toBeVisible({ timeout: 20_000 });
    await row.getByRole("button", { name: `Xuất hóa đơn điện tử cho phiếu ${saved.code}` }).click();

    const invoice = page.getByRole("dialog", { name: "Hóa đơn" });
    await expect(invoice.locator("tbody tr.ant-table-row").first()).toBeVisible({ timeout: 20_000 });
    const taxCode = invoice.getByRole("textbox", { name: /^Mã số thuế/ });
    await taxCode.fill("02344444444");

    let sent = false;
    page.on("request", (req) => {
      if (req.url().includes(`${EINVOICES}/issue`)) sent = true;
    });
    await invoice.getByRole("checkbox", { name: "Xuất hóa đơn đỏ" }).check();
    await invoice.getByRole("button", { name: "Lưu", exact: true }).click();
    const formatError = invoice.getByText(/^Mã số thuế không đúng/);
    await expect(formatError).toBeVisible();
    await expect(taxCode).toHaveAttribute("aria-invalid", "true");
    expect(sent).toBe(false);

    // 13 digits without the dash, and a wrong check digit: EasyInvoice refused
    // this one after the send, so it is caught here first.
    await taxCode.fill("0232323232323");
    await expect(formatError).toBeVisible();
    await invoice.getByRole("button", { name: "Lưu", exact: true }).click();
    expect(sent).toBe(false);

    // A branch code with its dash is one EasyInvoice takes: the error goes.
    await taxCode.fill("0123456787-001");
    await expect(formatError).toHaveCount(0);
    await expect(taxCode).not.toHaveAttribute("aria-invalid", "true");
  });

  // BA 2026-11-18: Lưu Nháp only keeps the form here — nothing is required, nothing
  // reaches EasyInvoice — and the dialog reopens as it was left.
  test("Lưu Nháp keeps the form in BlueDental as Nháp and reopens with it", async ({ page }) => {
    expect(receipt).toBeDefined();
    const saved = receipt!;
    await page.setViewportSize({ width: 1600, height: 900 });
    await login(page);

    const openDialog = async () => {
      await page.goto("/billing");
      await page.getByPlaceholder(SEARCH).fill(saved.code);
      const row = page.locator(".ant-table-tbody tr.ant-table-row").filter({ hasText: saved.code });
      await expect(row).toBeVisible({ timeout: 20_000 });
      await row.getByRole("button", { name: `Xuất hóa đơn điện tử cho phiếu ${saved.code}` }).click();
      const dialog = page.getByRole("dialog", { name: "Hóa đơn" });
      await expect(dialog.locator("tbody tr.ant-table-row").first()).toBeVisible({ timeout: 20_000 });
      return dialog;
    };

    const invoice = await openDialog();
    // Half typed — a Mã số thuế EasyInvoice would refuse and no email — is fine for a draft.
    await invoice.getByRole("textbox", { name: /^Tên đơn vị/ }).fill("E2E Công ty Nháp");
    await invoice.getByRole("textbox", { name: /^Mã số thuế/ }).fill("02344444444");
    await invoice.getByRole("textbox", { name: /^Email/ }).fill("");

    const issued = page.waitForResponse((res) => res.url().includes(`${EINVOICES}/issue`));
    await invoice.getByRole("button", { name: "Lưu Nháp" }).click();
    const response = await issued;
    expect(response.status()).toBe(200);
    expect(JSON.parse(response.request().postData() ?? "{}")).toMatchObject({ send: false });
    const body = (await response.json()) as { status: number; round: number; no: string | null };
    // 5 = Nháp: never sent, so no round and no number.
    expect(body).toMatchObject({ status: 5, round: 0, no: null });
    await expect(invoice).toBeHidden();

    // Reload, reopen: the dialog is as it was left.
    await page.reload();
    const reopened = await openDialog();
    await expect(reopened.getByRole("textbox", { name: /^Tên đơn vị/ })).toHaveValue("E2E Công ty Nháp");
    await expect(reopened.getByRole("textbox", { name: /^Mã số thuế/ })).toHaveValue("02344444444");

    // Still a Nháp on the server, read back with a separate request.
    const list = await call(page, `${EINVOICES}?patientPaymentId=${saved.id}`);
    expect(list.status).toBe(200);
    expect(list.body).toMatchObject({ items: [{ status: 5, round: 0 }] });
  });

  // Owner 2026-11-18: ticked, the PHIẾU THU tab opens only once EasyInvoice took the
  // invoice — a refused send leaves just the dialog, its error, and no new tab. The
  // receipt is cancelled behind the open dialog, so the server no longer finds it
  // (404) and refuses before anything reaches EasyInvoice. Last, because it spends the shared receipt.
  test("ticked, a refused send opens no PHIẾU THU tab and keeps the dialog", async ({ page, context }) => {
    expect(receipt).toBeDefined();
    const saved = receipt!;
    await page.setViewportSize({ width: 1600, height: 900 });
    await login(page);

    await page.goto("/billing");
    await page.getByPlaceholder(SEARCH).fill(saved.code);
    const row = page.locator(".ant-table-tbody tr.ant-table-row").filter({ hasText: saved.code });
    await expect(row).toBeVisible({ timeout: 20_000 });
    await row.getByRole("button", { name: `Xuất hóa đơn điện tử cho phiếu ${saved.code}` }).click();
    const invoice = page.getByRole("dialog", { name: "Hóa đơn", exact: true });
    await expect(invoice.locator("tbody tr.ant-table-row").first()).toBeVisible({ timeout: 20_000 });
    await invoice.getByRole("textbox", { name: /^Mã số thuế/ }).fill("0123456787");
    await invoice.getByRole("textbox", { name: /^Email/ }).fill("e2e@example.com");
    await invoice.getByRole("textbox", { name: /^Địa chỉ/ }).fill("1 E2E");
    await invoice.getByRole("checkbox", { name: "Xuất hóa đơn đỏ" }).check();

    const cancelled = await call(page, `${PAYMENTS_API}/${saved.id}/cancel`, {
      method: "POST",
      json: { reasonCode: 4, reason: "e2e refused send" },
    });
    expect(cancelled.status, JSON.stringify(cancelled.body)).toBeLessThan(300);
    receipt = undefined;

    const tabs: unknown[] = [];
    context.on("page", (tab) => tabs.push(tab));
    await invoice.getByRole("button", { name: "Lưu", exact: true }).click();
    const confirm = page.getByRole("dialog", { name: "Gửi hóa đơn sang EasyInvoice?" });
    const issued = page.waitForResponse((res) => res.url().includes(`${EINVOICES}/issue`));
    const rendered = page.waitForResponse((res) => res.url().includes(RECEIPT_PDF));
    await confirm.getByRole("button", { name: /Lưu$/ }).click();

    const refused = await issued;
    expect(refused.status()).toBe(404);
    await rendered;
    await expect(page.locator("[data-sonner-toast][data-type=error]")).toBeVisible();
    await expect(invoice).toBeVisible();
    await expect(invoice.getByRole("button", { name: "Lưu", exact: true })).toBeEnabled();
    expect(tabs).toHaveLength(0);
  });
});
