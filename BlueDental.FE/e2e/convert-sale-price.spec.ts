import { expect, test } from "@playwright/test";
import { login, runId } from "./fixtures/auth";
import { openNewSlip } from "./fixtures/ledgerReceipt";
import { createSaleService, LIST_PRICE, patientBranch, SALE_PRICE, slipLines, vnd as money } from "./fixtures/saleService";

/**
 * R-1184 — "Chuyển đổi dịch vụ" → Thay thế prices the new service at Danh
 * mục's "Giá sau giảm", as Chọn dịch vụ does: a 300.000 đ service with 10% off
 * reads and is written at 270.000 đ, not at its list price.
 *
 * Real stack: real login, real API, real PostgreSQL; the catalog entry and the
 * slip are written through the API with the browser's own session.
 */

test("Chuyển đổi → Thay thế charges the new service at its Giá sau giảm", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await login(page);
  const { patientId, slip } = await openNewSlip(page);
  const branch = await patientBranch(page, patientId);

  // A service of 300.000 đ with 10% off in Danh mục: "Giá sau giảm" 270.000 đ.
  const name = `e2e chuyển đổi giá sau giảm ${runId()}`;
  const entry = await createSaleService(page, branch, name);

  // The entry stays: a line now uses it, so Danh mục refuses to delete it
  // (Catalogs:0033), and its six-digit run id keeps other specs off it.
  await page.reload();
  const row = page.locator(".pdt-table tbody tr.ant-table-row").first();
  await row.locator(".pdt-status-trigger").click();
  await page.getByRole("menuitem", { name: "Chuyển đổi" }).click();
  const dialog = page.getByRole("dialog", { name: "Chuyển đổi dịch vụ" });
  await expect(dialog).toBeVisible();

  const picker = dialog.getByRole("combobox", { name: /Thêm dịch vụ mới/ });
  await picker.click();
  await picker.pressSequentially(name);
  const option = page
    .locator(".tp-service-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option")
    .filter({ hasText: name });
  await expect(option).toHaveCount(1, { timeout: 15_000 });
  // R-1185: the option reads the sale price alone, as Thông tin thanh toán
  // will charge — no list price beside it (owner, 2026-11-10).
  await expect(option.locator(".tp-opt-price")).toHaveText(money(SALE_PRICE));
  await option.click();

  // Thông tin thanh toán of the new service, one tooth: Tổng tiền and Còn lại
  // at the sale price, nothing taken off on top of it.
  const facts = dialog.locator(".cvt-section").last().locator(".cvt-fact-value");
  await expect(facts).toHaveText([money(SALE_PRICE), money(0), money(0), money(0), money(SALE_PRICE)]);

  await dialog.getByRole("textbox", { name: /Ghi chú/ }).fill("R-1184 giá sau giảm");
  for (const label of ["Bác sĩ chẩn đoán 1", "Nhân sự tư vấn 1"]) {
    await dialog.getByRole("combobox", { name: label }).click();
    const first = page
      .locator(".ant-select-dropdown:not(.tp-service-dropdown):not(.ant-select-dropdown-hidden)")
      .last()
      .locator(".ant-select-item-option")
      .first();
    await expect(first).toBeVisible();
    await first.click();
  }

  const converted = page.waitForResponse(
    (res) => res.url().includes("/convert") && res.request().method() === "POST",
  );
  await dialog.getByRole("button", { name: "Lưu" }).click();
  expect((await converted).ok()).toBeTruthy();
  await expect(dialog).toBeHidden();

  // Read back on a separate request: the new line was written at 270.000 đ.
  const line = (await slipLines(page, branch, slip.id)).find((item) => item.serviceId === entry.id);
  expect(line).toBeDefined();
  expect(line!.price).toBe(SALE_PRICE);
  expect(line!.originalPrice).toBe(SALE_PRICE);
  expect(line!.effectiveAmount).toBe(SALE_PRICE);

  // And the slip table, reloaded, prints it so.
  await page.reload();
  const newRow = page.locator(".pdt-table tbody tr.ant-table-row", { hasText: name });
  await expect(newRow).toContainText(money(SALE_PRICE));
  await expect(newRow).not.toContainText(money(LIST_PRICE));
});
