import { expect, test, type Locator, type Page } from "@playwright/test";
import { login } from "./fixtures/auth";
import { answerQuestionYes, call, money, openNewSlip, paymentQuestion, PAYMENTS_API, type Receipt } from "./fixtures/ledgerReceipt";

/**
 * R-907 (owner 2026-10-12): "In Hóa Đơn" on the slip and the "Hóa đơn" icon on
 * its row open "Tạo phiếu thanh toán" — not the e-invoice dialog. The dialog
 * walks ① Chọn số phiếu → ② Chọn dịch vụ → ③ Thông tin thanh toán, lists only
 * the slips and services that still owe, totals the ticked ones, stores
 * "Xuất hóa đơn đỏ" as a flag (nothing is sent to EasyInvoice), and on Lưu →
 * "Có" writes the receipt "Hoàn tất" (owner 2026-10-13, R-929) and opens its
 * PHIẾU THU in a new tab.
 *
 * Real stack only: real login, a fresh slip through the real dialogs, the
 * receipt through the real API into PostgreSQL, read back with a separate GET.
 */

const RECEIPT_PDF = "/api/v1/app/e-invoices/receipt-pdf";

type StoredReceipt = Receipt & { redInvoiceRequested: boolean };

/** Typed key by key into the picker's own search box, as a user does — `fill` alone does not reach it. */
async function typeSlipSearch(popup: Locator, text: string): Promise<void> {
  const box = popup.getByPlaceholder("Tìm theo số phiếu hoặc ngày tạo");
  await box.click();
  await box.pressSequentially(text);
}

async function storedReceipt(page: Page, receipt: Receipt): Promise<StoredReceipt | undefined> {
  const listed = await call(
    page,
    `${PAYMENTS_API}?patientId=${receipt.patientId}&includePending=true&maxResultCount=1000`,
  );
  return ((listed.body.items ?? []) as StoredReceipt[]).find((item) => item.id === receipt.id);
}

test("In Hóa Đơn → Tạo phiếu thanh toán: slip, owing services, totals, red-invoice flag, PHIẾU THU tab", async ({
  page,
  context,
}) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await login(page);
  await openNewSlip(page);

  // ── Opened from the slip: ① is done, the slip's owing line is listed ──────
  await page.getByRole("button", { name: "In Hóa Đơn" }).click();
  const dialog = page.getByRole("dialog", { name: "Tạo phiếu thanh toán" });
  await expect(dialog).toBeVisible();
  const chip = dialog.locator(".pd-newpay-slipchip");
  await expect(chip).toHaveText(/^DT\d+$/);
  const slipCode = (await chip.innerText()).trim();
  await expect(dialog.locator(".pd-newpay-slipselect")).toContainText(slipCode);
  await expect(dialog.locator(".pd-newpay-step--done")).toHaveText(["Chọn số phiếu"]);
  await expect(dialog.locator(".pd-newpay-step--current")).toContainText("Chọn dịch vụ");

  const cards = dialog.locator(".pd-newpay-lines > li");
  await expect(cards).toHaveCount(1);
  const card = cards.first();
  await expect(card).toContainText("Số lượng: 1");
  await expect(card).toContainText("Đã thanh toán: 0");
  const due = money(await card.locator(".pd-newpay-due").innerText());
  expect(due).toBeGreaterThan(0);
  await expect(dialog.getByText("Bạn cần chọn ít nhất 1 dịch vụ")).toBeVisible();

  // ── The slip picker: search box, header, this slip as "Chưa thanh toán" ───
  await dialog.locator(".pd-newpay-slipselect").click();
  const popup = page.locator(".pd-newpay-slippop:visible");
  await expect(popup.getByPlaceholder("Tìm theo số phiếu hoặc ngày tạo")).toBeVisible();
  await expect(popup.locator(".pd-newpay-sliphead")).toContainText("Số phiếu");
  await typeSlipSearch(popup, slipCode);
  const slipRow = popup.locator(".ant-select-item-option", { hasText: slipCode });
  await expect(slipRow).toHaveCount(1);
  await expect(slipRow).toContainText("Chưa thanh toán");
  await expect(slipRow).toContainText("1 dịch vụ");
  expect(money(await slipRow.locator(".pd-newpay-sliprow-debt").innerText())).toBe(due);
  await slipRow.click();
  await expect(cards).toHaveCount(1);

  // ── ② ticked: the card lights up, the totals follow, the amount fills ────
  await dialog.getByRole("checkbox", { name: "Chọn Tất Cả" }).check();
  await expect(card).toHaveClass(/pd-newpay-card--on/);
  await expect(dialog.locator(".pd-newpay-step--done")).toHaveText(["Chọn số phiếu", "Chọn dịch vụ"]);
  const debtToPay = dialog.locator(".pd-newpay-fact", { hasText: "Còn nợ cần thanh toán" });
  expect(money(await debtToPay.innerText())).toBe(due);
  await expect(dialog.getByText("Tự động bằng tổng còn nợ của các dịch vụ đã chọn")).toBeVisible();
  await expect.poll(async () => money(await dialog.locator(".pd-newpay-amount").inputValue())).toBe(due);

  // ── ③ Xuất hóa đơn đỏ is only remembered; Lưu → Có prints the PHIẾU THU ──
  await dialog.getByRole("checkbox", { name: "Xuất hóa đơn đỏ" }).check();
  await dialog.getByRole("button", { name: "Lưu" }).click();
  // The tab opens on "Có", the click that writes the receipt.
  const saved = page.waitForResponse(
    (res) => res.url().includes(PAYMENTS_API) && res.request().method() === "POST",
  );
  const printed = page.waitForResponse(
    (res) => res.url().endsWith(RECEIPT_PDF) && res.request().method() === "POST",
  );
  const tab = context.waitForEvent("page");
  await answerQuestionYes(page);
  const response = await saved;
  expect(response.ok(), await response.text()).toBeTruthy();
  const receipt = (await response.json()) as StoredReceipt;
  expect(receipt.status).toBe(2);
  expect(receipt.redInvoiceRequested).toBe(true);
  expect(receipt.amount).toBe(due);
  const pdf = await printed;
  expect(pdf.status()).toBe(200);
  expect(pdf.headers()["content-type"]).toContain("application/pdf");
  // A browser with a PDF viewer shows the blob URL; headless Chromium (no
  // viewer) hands the same navigation over as a download of that tab.
  const receiptTab = await tab;
  const landed = await Promise.race([
    receiptTab.waitForEvent("download", { timeout: 20_000 }).then((download) => download.url()),
    expect.poll(() => receiptTab.url(), { timeout: 20_000 }).toMatch(/^blob:/).then(() => receiptTab.url()),
  ]);
  expect(landed).toMatch(/^blob:/);
  await receiptTab.close();
  await expect(paymentQuestion(page)).toBeHidden();
  await expect(dialog).toBeHidden();

  // ── Persisted: a separate GET after a reload reads the same flag ─────────
  await page.reload();
  await expect.poll(async () => (await storedReceipt(page, receipt))?.redInvoiceRequested).toBe(true);
  expect((await storedReceipt(page, receipt))?.status).toBe(2);
  await page.getByRole("tab", { name: "Thanh toán", exact: true }).click();
  const row = page.locator(".ant-table-row", { hasText: receipt.code });
  await expect(row.locator(".tp-pill")).toHaveText("Hoàn tất");

  // ── Paid in full on Có, the slip drops out of every other slip's picker ──
  // The patient's Kế hoạch điều trị tab, keeping the branch the URL names.
  const list = new URL(page.url());
  list.pathname = `/patient/${receipt.patientId}`;
  list.searchParams.delete("planTab");
  list.searchParams.set("tab", "treatment-plan");
  await page.goto(list.toString());
  const planRows = page.locator(".tp-table .tp-code");
  await expect(planRows.first()).toBeVisible({ timeout: 20_000 });
  const codes = (await planRows.allInnerTexts()).map((code) => code.trim());
  const other = codes.find((code) => code !== slipCode);
  test.skip(!other, "the patient has no other slip to open the dialog from");
  await page.getByRole("button", { name: `Phiếu thu ${other}` }).click();
  const next = page.getByRole("dialog", { name: "Tạo phiếu thanh toán" });
  await expect(next).toBeVisible();
  await next.locator(".pd-newpay-slipselect").click();
  const nextPopup = page.locator(".pd-newpay-slippop:visible");
  await typeSlipSearch(nextPopup, slipCode);
  await expect(nextPopup.locator(".ant-select-item-option", { hasText: slipCode })).toHaveCount(0);
});

/** The local calendar day `offset` days from today, as "YYYY-MM-DD" and "DD/MM/YYYY". */
function dayFromToday(offset: number): { iso: string; shown: string } {
  const day = new Date();
  day.setDate(day.getDate() + offset);
  const dd = String(day.getDate()).padStart(2, "0");
  const mm = String(day.getMonth() + 1).padStart(2, "0");
  return { iso: `${day.getFullYear()}-${mm}-${dd}`, shown: `${dd}/${mm}/${day.getFullYear()}` };
}

/** The clinic's calendar day (UTC+7) of a stored instant. */
const clinicDay = (instant: string) =>
  new Date(instant).toLocaleDateString("en-CA", { timeZone: "Asia/Ho_Chi_Minh" });

test("Ngày thanh toán: a past day is picked, saved, printed and listed; a later day is refused", async ({
  page,
  context,
}) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await login(page);
  await openNewSlip(page);

  const today = dayFromToday(0);
  const past = dayFromToday(-3);
  const tomorrow = dayFromToday(1);

  // ── Opens on today; Nội dung follows the picked day ──────────────────────
  await page.getByRole("button", { name: "In Hóa Đơn" }).click();
  const dialog = page.getByRole("dialog", { name: "Tạo phiếu thanh toán" });
  await expect(dialog).toBeVisible();
  const dateBox = dialog.getByLabel("Ngày thanh toán");
  await expect(dateBox).toHaveValue(today.shown);
  await expect(dialog).toContainText(`Thanh toán điều trị ngày ${today.shown}`);

  await dateBox.click();
  const panel = page.locator(".ant-picker-dropdown:visible");
  await expect(panel.locator(`td[title="${tomorrow.iso}"]`)).toHaveClass(/ant-picker-cell-disabled/);
  await panel.locator(`td[title="${past.iso}"]`).click();
  await expect(dateBox).toHaveValue(past.shown);
  await expect(dialog).toContainText(`Thanh toán điều trị ngày ${past.shown}`);

  // ── Saved with that day; PHIẾU THU is dated with it too ──────────────────
  // Half the line, so it still owes for the server check at the end.
  await dialog.getByRole("checkbox", { name: "Chọn Tất Cả" }).check();
  const due = money(await dialog.locator(".pd-newpay-lines > li .pd-newpay-due").first().innerText());
  await dialog.locator(".pd-newpay-amount").fill(String(Math.max(2, Math.floor(due / 2))));
  await dialog.getByRole("button", { name: "Lưu" }).click();
  const saved = page.waitForResponse(
    (res) => res.url().endsWith(PAYMENTS_API) && res.request().method() === "POST",
  );
  const printed = page.waitForRequest(
    (req) => req.url().endsWith(RECEIPT_PDF) && req.method() === "POST",
  );
  const tab = context.waitForEvent("page");
  await answerQuestionYes(page);
  const response = await saved;
  expect(response.ok(), await response.text()).toBeTruthy();
  const receipt = (await response.json()) as StoredReceipt & { paidAt: string; creationTime: string };
  expect(clinicDay(receipt.paidAt)).toBe(past.iso);
  expect(clinicDay(receipt.creationTime)).toBe(today.iso);
  expect((await printed).postDataJSON()).toMatchObject({ patientPaymentId: receipt.id, arisingDate: past.iso });
  await (await tab).close();
  await expect(dialog).toBeHidden();

  // ── Persisted: after a reload, a separate GET and the Thanh toán tab ─────
  await page.reload();
  const stored = (await storedReceipt(page, receipt)) as (StoredReceipt & { paidAt: string }) | undefined;
  expect(stored && clinicDay(stored.paidAt)).toBe(past.iso);
  await page.getByRole("tab", { name: "Thanh toán", exact: true }).click();
  await expect(page.getByRole("columnheader", { name: "Ngày thanh toán" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Ngày tạo", exact: true })).toHaveCount(0);
  const row = page.locator(".ant-table-row", { hasText: receipt.code });
  // The day only, no clock time (owner 2026-10-14).
  await expect(row.locator("td").nth(1)).toHaveText(past.shown);

  // "Xem phiếu" says the same: "Ngày thanh toán", the day only, no "Ngày tạo".
  await row.getByRole("button", { name: `Xem phiếu ${receipt.code}` }).click();
  const detail = page.locator(".pdt-receipt.pdt-screen");
  const dateFact = detail.locator(".pdt-receipt-fact", { has: page.locator("dt", { hasText: /^Ngày thanh toán$/ }) });
  await expect(dateFact.locator("dd")).toHaveText(past.shown);
  await expect(detail.locator("dt", { hasText: /^Ngày tạo$/ })).toHaveCount(0);
  await page.keyboard.press("Escape");

  // ── The server refuses a later day whatever the picker allows ────────────
  const future = await call(page, PAYMENTS_API, {
    method: "POST",
    json: {
      patientId: receipt.patientId,
      clinicBranchId: receipt.clinicBranchId,
      treatmentPlanId: receipt.treatmentPlanId,
      treatmentServiceIds: [receipt.lines[0].treatmentServiceId],
      splitMode: 1,
      items: [],
      kind: 1,
      method: 1,
      amount: 1,
      staffId: receipt.staffId,
      paidAt: `${tomorrow.iso}T10:00:00+07:00`,
    },
  });
  expect(future.status).toBe(403);
  expect((future.body.error as { code?: string } | undefined)?.code).toBe("BlueDental:Billing:0094");
});
