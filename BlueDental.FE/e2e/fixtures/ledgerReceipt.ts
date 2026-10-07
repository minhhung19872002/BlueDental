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
  /** 1 = "Chưa thanh toán", 2 = "Hoàn tất" (BA 2026-10-08). */
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
 * "Tạo Phiếu Thanh Toán" for half of the first line, then "Xác nhận thanh
 * toán" on its row: a new receipt waits as "Chưa thanh toán" and only the
 * confirmed one moves money (BA 2026-10-08). Returns the confirmed receipt.
 */
export async function collectOnFirstLine(page: Page): Promise<Receipt> {
  const pending = await writePendingOnFirstLine(page);
  return confirmOnRow(page, pending.code);
}

/** "Xác nhận thanh toán" on the receipt's row, the dialog's figures left as written. */
export async function confirmOnRow(page: Page, code: string): Promise<Receipt> {
  await page.getByRole("button", { name: `Xác nhận thanh toán phiếu ${code}` }).click();
  const dialog = page.getByRole("dialog", { name: "Xác nhận thanh toán" });
  await expect(dialog).toBeVisible();
  const confirmed = page.waitForResponse(
    (res) => res.url().includes(PAYMENTS_API) && res.url().endsWith("/confirm") && res.request().method() === "PUT",
  );
  await dialog.getByRole("button", { name: "Xác nhận thanh toán" }).click();
  const response = await confirmed;
  expect(response.ok(), await response.text()).toBeTruthy();
  await expect(dialog).toBeHidden();
  const receipt = (await response.json()) as Receipt;
  expect(receipt.status).toBe(2);
  return receipt;
}

/** "Tạo Phiếu Thanh Toán" for half of the first line; returns the receipt still "Chưa thanh toán". */
export async function writePendingOnFirstLine(page: Page): Promise<Receipt> {
  await page.getByRole("button", { name: "Tạo Phiếu Thanh Toán" }).click();
  const dialog = page.getByRole("dialog", { name: "Tạo phiếu thanh toán" });
  const line = dialog.locator(".pd-newpay-lines > li").first();
  await line.locator("input[type=checkbox]").check();
  const due = money(await line.locator(".pd-newpay-due").innerText());
  await dialog.locator(".pd-newpay-amount").fill(String(Math.max(2, Math.floor(due / 2))));
  const saved = page.waitForResponse(
    (res) => res.url().includes(PAYMENTS_API) && res.request().method() === "POST",
  );
  await dialog.getByRole("button", { name: "Lưu" }).click();
  const response = await saved;
  expect(response.ok()).toBeTruthy();
  await expect(dialog).toBeHidden();
  const receipt = (await response.json()) as Receipt;
  expect(receipt.status).toBe(1);
  return receipt;
}

/** The body PUT …/{id} and PUT …/{id}/confirm take: the receipt's own figures unless overridden. */
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

/**
 * "Xác nhận thanh toán" through the API, the receipt's figures unchanged. For
 * receipts written where the screen offers no confirm button (the patient
 * record's treatment tab); the button itself lives on the plan's Thanh toán tab.
 */
export async function confirmAsWritten(page: Page, receipt: Receipt): Promise<Receipt> {
  const confirmed = await call(page, `${PAYMENTS_API}/${receipt.id}/confirm`, {
    method: "PUT",
    json: revisionOf(receipt),
  });
  expect(confirmed.status, JSON.stringify(confirmed.body)).toBe(200);
  expect(confirmed.body.status).toBe(2);
  return confirmed.body as unknown as Receipt;
}
