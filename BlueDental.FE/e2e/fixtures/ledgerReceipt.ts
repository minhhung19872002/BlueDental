import { expect, type Locator, type Page } from "@playwright/test";
import { assertRealApiTraffic } from "./auth";

/**
 * A THANHTOAN receipt written the way the BA does it: a fresh slip on the first
 * patient, then "Tạo Phiếu Thanh Toán" on its Thanh toán tab. Shared by the
 * Tài chính → Thanh toán specs.
 */

export const PAYMENTS_API = "/api/v1/app/patient-payments";

export interface Receipt {
  id: string;
  code: string;
  amount: number;
  method: number;
  patientId: string;
  clinicBranchId: string;
  treatmentPlanId: string;
  treatmentPlanCode: string;
  staffId: string;
  /** 1 = "Chưa thanh toán" (legacy only), 2 = "Hoàn tất" — every new receipt (owner 2026-10-13). */
  status: number;
  lines: { treatmentServiceId: string; amount?: number }[];
}

/** A real request on the signed-in session, with the antiforgery header the app sends. */
export async function call(
  page: Page,
  url: string,
  options: { method?: "GET" | "POST" | "PUT" | "DELETE"; json?: unknown } = {},
): Promise<{ status: number; body: Record<string, unknown> }> {
  const cookies = await page.context().cookies();
  const xsrf = cookies.find((cookie) => cookie.name === "XSRF-TOKEN")?.value;
  const res = await page.request.fetch(url, {
    method: options.method ?? "GET",
    data: options.json,
    headers: xsrf ? { RequestVerificationToken: decodeURIComponent(xsrf) } : {},
  });
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { status: res.status(), body };
}

export const money = (text: string) => Number(text.replace(/[^\d]/g, ""));

export function openDropdown(page: Page, panel = ".ant-select-dropdown:not(.tp-service-dropdown)") {
  return page.locator(`${panel}:not(.ant-select-dropdown-hidden)`).last();
}

/** The first service worth something — a zero-priced one leaves nothing to collect. */
export async function pickPricedService(dropdown: Locator): Promise<void> {
  const options = dropdown.locator(".ant-select-item-option:has(.tp-opt-service)");
  await expect(options.first()).toBeVisible();
  const count = await options.count();
  for (let index = 0; index < count; index++) {
    const option = options.nth(index);
    if (money(await option.locator(".tp-opt-price").innerText()) > 0) {
      await option.click();
      return;
    }
  }
  throw new Error("Danh mục dịch vụ không có mục nào còn giá");
}

/** A fresh one-line slip on the first patient; ends on its plan detail. */
export async function openNewSlip(page: Page): Promise<void> {
  await page.goto("/patient");
  await assertRealApiTraffic(page, "/api/v1/app/patients");
  const firstName = page.locator("tr.ant-table-row .bd-patient-name").first();
  await expect(firstName).toBeVisible();
  await firstName.click();
  await expect(page).toHaveURL(/\/patient\/[0-9a-f-]{36}/);

  await page.getByRole("link", { name: "Kế hoạch điều trị" }).click();
  const before = await page.locator(".tp-table .tp-code").allTextContents();
  await page.getByRole("button", { name: "Tạo kế hoạch mới" }).click();
  const dialog = page.getByRole("dialog", { name: "Tạo phiếu dịch vụ" });
  await expect(dialog).toBeVisible();
  await page.getByRole("combobox", { name: /Nhân sự tư vấn 1/ }).click();
  await openDropdown(page).locator(".ant-select-item-option").first().click();
  await dialog.getByRole("combobox", { name: /Thêm dịch vụ mới/ }).click();
  await pickPricedService(openDropdown(page, ".tp-service-dropdown"));
  await dialog.locator(".tp-tooth-btn").click();
  const teeth = page.getByRole("dialog", { name: "Chọn răng" });
  await teeth.getByRole("button", { name: "Răng 14", exact: true }).click();
  await teeth.locator(".tp-teeth-foot button").click();
  await dialog.getByRole("button", { name: "Lưu" }).click();
  await expect(dialog).toBeHidden();

  const unseen = async () =>
    (await page.locator(".tp-table .tp-code").allTextContents()).find((c) => !before.includes(c)) ?? "";
  await expect.poll(unseen, { timeout: 15_000 }).toMatch(/^DT\d+$/);
  await page.locator(".tp-table .tp-code", { hasText: await unseen() }).click();
  await expect(page).toHaveURL(/\/patient\/[0-9a-f-]{36}\/treatment-plan\/[0-9a-f-]{36}/);
}

/**
 * "Tạo Phiếu Thanh Toán" for half of the first line, "Lưu", then "Có" in the
 * "Xác nhận thanh toán" question: the receipt is written "Hoàn tất" and moves
 * money at once (owner 2026-10-13). Returns the saved receipt.
 *
 * `redInvoice` ticks "Xuất hóa đơn đỏ" first: a Hoàn tất receipt refuses every
 * later write, so the flag can only go on as the receipt is made.
 */
export async function collectOnFirstLine(page: Page, { redInvoice = false } = {}): Promise<Receipt> {
  await page.getByRole("button", { name: "Tạo Phiếu Thanh Toán" }).click();
  const dialog = page.getByRole("dialog", { name: "Tạo phiếu thanh toán" });
  const line = dialog.locator(".pd-newpay-lines > li").first();
  await line.locator("input[type=checkbox]").check();
  const due = money(await line.locator(".pd-newpay-due").innerText());
  await dialog.locator(".pd-newpay-amount").fill(String(Math.max(2, Math.floor(due / 2))));
  if (redInvoice) await dialog.getByRole("checkbox", { name: "Xuất hóa đơn đỏ" }).check();
  await dialog.getByRole("button", { name: "Lưu" }).click();
  return answerYes(page, dialog);
}

/**
 * The "Xác nhận thanh toán" question "Lưu" raises on a new receipt: "Có" sends
 * the one POST, and both dialogs close on the Hoàn tất receipt it returns.
 */
export async function answerYes(page: Page, createDialog: Locator): Promise<Receipt> {
  const saved = page.waitForResponse(
    (res) => res.url().endsWith(PAYMENTS_API) && res.request().method() === "POST",
  );
  await answerQuestionYes(page);
  const response = await saved;
  expect(response.ok(), await response.text()).toBeTruthy();
  await expect(paymentQuestion(page)).toBeHidden();
  await expect(createDialog).toBeHidden();
  const receipt = (await response.json()) as Receipt;
  expect(receipt.status).toBe(2);
  return receipt;
}

/** The question "Lưu" raises on a new receipt, the create dialog still open behind it. */
export function paymentQuestion(page: Page): Locator {
  return page.getByRole("dialog", { name: "Xác nhận thanh toán", exact: true });
}

/**
 * "Có" in that question — for specs that watch the POST themselves. The
 * question names the amount and says the receipt is paid once saved.
 */
export async function answerQuestionYes(page: Page): Promise<void> {
  const question = paymentQuestion(page);
  await expect(question).toBeVisible();
  await expect(question).toContainText("Phiếu sẽ được ghi nhận là đã thanh toán ngay khi lưu.");
  await question.getByRole("button", { name: "Có" }).click();
}

/** The body PUT …/{id} and PUT …/{id}/confirm take: the receipt's own figures unless overridden. Both refuse a Hoàn tất receipt. */
export function revisionOf(receipt: Receipt & { splitMode?: number; note?: string | null; paymentAccountId?: string | null }, amount = receipt.amount) {
  const splitMode = receipt.splitMode ?? 1;
  return {
    treatmentServiceIds: receipt.lines.map((line) => line.treatmentServiceId),
    splitMode,
    // Thủ công (2) names each line's share; Tự động leaves the split to the server.
    items: splitMode === 2 ? receipt.lines.map((line) => ({ treatmentServiceId: line.treatmentServiceId, amount: line.amount ?? 0 })) : [],
    method: receipt.method,
    amount,
    note: receipt.note ?? null,
    paymentAccountId: receipt.paymentAccountId ?? null,
  };
}
