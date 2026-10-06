import { expect, test } from "@playwright/test";
import { login } from "./fixtures/auth";
import { call, money, openNewSlip, PAYMENTS_API, type Receipt } from "./fixtures/ledgerReceipt";

/**
 * Bug list item 24: Công nợ went negative because a receipt could collect
 * more than the services still owed. "Tạo phiếu thanh toán" now holds the
 * amount at what the ticked services owe (VAT included): typing or pasting
 * past it leaves the box at exactly that figure, in Tự động and in each
 * Thủ công box alike.
 *
 * Real stack only: real login, a fresh slip through the real dialogs, the
 * receipt through the real API into PostgreSQL.
 */
test("Tạo phiếu thanh toán never takes more than the ticked services owe", async ({ page }) => {
  await login(page);
  await openNewSlip(page);
  await page.getByRole("tab", { name: "Thanh toán", exact: true }).click();

  await page.getByRole("button", { name: "Tạo Phiếu Thanh Toán" }).click();
  const dialog = page.getByRole("dialog", { name: "Tạo phiếu thanh toán" });
  const line = dialog.locator(".pd-newpay-lines > li").first();
  await line.locator("input[type=checkbox]").check();
  const due = money(await line.locator(".pd-newpay-due").innerText());
  expect(due).toBeGreaterThan(0);

  // Tự động — typed past the ceiling, keystroke by keystroke…
  const amount = dialog.locator(".pd-newpay-amount");
  await amount.fill("");
  await amount.pressSequentially(String(due * 10));
  await expect.poll(async () => money(await amount.inputValue())).toBe(due);

  // …and pasted past it in one go.
  await amount.fill(String(due + 1));
  await expect.poll(async () => money(await amount.inputValue())).toBe(due);
  await expect(dialog.getByText("Số tiền thanh toán không được vượt quá")).toHaveCount(0);

  // An amount under the ceiling is kept as typed.
  const part = Math.max(1, Math.floor(due / 2));
  await amount.fill(String(part));
  await expect.poll(async () => money(await amount.inputValue())).toBe(part);

  // Thủ công — each service's box stops at that service's Còn nợ.
  await dialog.getByText("Chia Tiền Thủ Công").click();
  const share = dialog.locator(".pd-newpay-manual input").first();
  await share.fill(String(due * 3));
  await expect.poll(async () => money(await share.inputValue())).toBe(due);

  const saved = page.waitForResponse(
    (res) => res.url().includes(PAYMENTS_API) && res.request().method() === "POST",
  );
  await dialog.getByRole("button", { name: "Lưu" }).click();
  const response = await saved;
  expect(response.ok()).toBeTruthy();
  await expect(dialog).toBeHidden();

  // Read back with a separate request: the receipt holds exactly what was owed.
  const receipt = (await response.json()) as Receipt;
  const stored = await call(page, `${PAYMENTS_API}?patientId=${receipt.patientId}&maxResultCount=1000`);
  const items = (stored.body.items ?? []) as Receipt[];
  expect(items.find((item) => item.id === receipt.id)?.amount).toBe(due);

  // The line is settled, so the next dialog has nothing on it left to collect.
  await page.reload();
  await page.getByRole("tab", { name: "Thanh toán", exact: true }).click();
  await page.getByRole("button", { name: "Tạo Phiếu Thanh Toán" }).click();
  const next = page.getByRole("dialog", { name: "Tạo phiếu thanh toán" });
  await expect(next.locator(".pd-newpay-lines > li")).toHaveCount(0);
});
