import { expect, test, type Page } from "@playwright/test";
import { BRANCH2_USER, login } from "./fixtures/auth";
import { PAYMENTS_API, call, collectOnFirstLine, openNewSlip, type Receipt } from "./fixtures/ledgerReceipt";

/**
 * Feature: Phát Hành in the "Hóa đơn" dialog always prints the PHIẾU THU (BA,
 * 2026-10-07). The server fills `wwwroot/templates/PHIẾU THU.docx` and
 * Gotenberg (LibreOffice in Docker) turns it into a PDF; the app opens it in a
 * new tab. "Xuất hóa đơn đỏ" is left unticked throughout — ticked, Phát Hành
 * would also sign a real e-invoice on the provider.
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

test.describe("Hóa đơn → Phát Hành prints the PHIẾU THU", () => {
  test.afterAll(async ({ browser }) => {
    if (!receipt) return;
    const page = await browser.newPage();
    await login(page);
    await call(page, `${PAYMENTS_API}/${receipt.id}/cancel`, { method: "POST", json: { reason: "e2e cleanup" } });
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

  test("Phát Hành opens the receipt PDF in a new tab and leaves the dialog open", async ({ page, context }) => {
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
    await invoice.getByRole("button", { name: "Phát Hành" }).click();

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

    // The dialog stays, to correct the data and print again.
    await expect(invoice).toBeVisible();
    await expect(invoice.getByRole("button", { name: "Phát Hành" })).toBeEnabled();
    await tab.close();
  });

  // BA 2026-10-08: ticked, Tên khách hàng, Mã số thuế, Số ĐT and Email are required.
  // Both checks stop before EasyInvoice: the dialog never sends, the server refuses first.
  test("Xuất hóa đơn đỏ requires the buyer's name, tax code, phone and email", async ({ page }) => {
    expect(receipt).toBeDefined();
    const saved = receipt!;
    await page.setViewportSize({ width: 1600, height: 900 });
    await login(page);

    const refused = await call(page, `${EINVOICES}/issue`, {
      method: "POST",
      json: {
        patientPaymentId: saved.id,
        publish: true,
        buyerName: "E2E Buyer",
        taxCode: "0100000000",
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
    await taxCode.fill("");
    await email.fill("");

    // Unticked, the blank fields are fine: no asterisk, no error.
    await expect(invoice.locator(".floating-field-required")).toHaveCount(0);

    await invoice.getByRole("checkbox", { name: "Xuất hóa đơn đỏ" }).check();
    await expect(invoice.locator(".floating-field-required")).toHaveCount(4);

    let sent = false;
    page.on("request", (req) => {
      if (req.url().includes(`${EINVOICES}/issue`) || req.url().includes(RECEIPT_PDF)) sent = true;
    });
    await invoice.getByRole("button", { name: "Phát Hành" }).click();
    await expect(invoice.getByText("Vui lòng nhập Mã số thuế")).toBeVisible();
    await expect(invoice.getByText("Vui lòng nhập Email")).toBeVisible();
    await expect(taxCode).toHaveAttribute("aria-invalid", "true");
    // No confirm, no receipt, nothing sent.
    await expect(page.getByRole("dialog", { name: /^Phát hành hóa đơn/ })).toHaveCount(0);
    expect(sent).toBe(false);

    // Typing clears that field's error; unticking clears the rest.
    await taxCode.fill("0100000000");
    await expect(invoice.getByText("Vui lòng nhập Mã số thuế")).toHaveCount(0);
    await invoice.getByRole("checkbox", { name: "Xuất hóa đơn đỏ" }).uncheck();
    await expect(invoice.getByText("Vui lòng nhập Email")).toHaveCount(0);
    await expect(invoice.locator(".floating-field-required")).toHaveCount(0);
  });
});
