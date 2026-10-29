import { expect, test } from "@playwright/test";
import type { Locator } from "@playwright/test";
import { login } from "./fixtures/auth";
import { call, money, openNewSlip, PAYMENTS_API, saveReceipt, type Receipt } from "./fixtures/ledgerReceipt";

/**
 * R-1040 (BA, 2026-10-26): clicking an amount box in "Tạo phiếu thanh toán"
 * highlights the whole figure, so typing replaces it instead of appending to
 * the pre-filled Còn nợ — in Tự động and in each Thủ công box alike.
 *
 * Real stack only: real login, a fresh slip through the real dialogs, the
 * receipt through the real API into PostgreSQL.
 */
async function selectedText(box: Locator) {
  return box.evaluate((input: HTMLInputElement) =>
    input.value.slice(input.selectionStart ?? 0, input.selectionEnd ?? 0),
  );
}

test("Tạo phiếu thanh toán highlights the amount on click", async ({ page }) => {
  await login(page);
  await openNewSlip(page);
  await page.getByRole("tab", { name: "Thanh toán", exact: true }).click();

  await page.getByRole("button", { name: "Tạo Phiếu Thanh Toán" }).click();
  const dialog = page.getByRole("dialog", { name: "Tạo phiếu thanh toán" });
  const line = dialog.locator(".pd-newpay-lines > li").first();
  await line.locator("input[type=checkbox]").check();
  const due = money(await line.locator(".pd-newpay-due").innerText());
  expect(due).toBeGreaterThan(1);

  // Tự động: a click lands mid-figure yet the whole of it is highlighted.
  const amount = dialog.locator(".pd-newpay-amount");
  await amount.click();
  await expect.poll(() => selectedText(amount)).toBe(await amount.inputValue());

  // Thủ công: same, and typing replaces the pre-filled figure.
  await dialog.getByText("Chia Tiền Thủ Công").click();
  const share = dialog.locator(".pd-newpay-manual input").first();
  await expect.poll(async () => money(await share.inputValue())).toBe(due);
  await share.click();
  await expect.poll(() => selectedText(share)).toBe(await share.inputValue());
  const part = Math.floor(due / 2);
  await page.keyboard.type(String(part));
  await expect.poll(async () => money(await share.inputValue())).toBe(part);

  // A second click inside the focused box places the caret as usual.
  await share.click();
  await expect.poll(() => selectedText(share)).toBe("");

  // Saved and read back with a separate request: the typed figure, not appended digits.
  const receipt = await saveReceipt(page, dialog);
  const stored = await call(page, `${PAYMENTS_API}?patientId=${receipt.patientId}&includePending=true&maxResultCount=1000`);
  const items = (stored.body.items ?? []) as Receipt[];
  expect(items.find((item) => item.id === receipt.id)?.amount).toBe(part);
});
