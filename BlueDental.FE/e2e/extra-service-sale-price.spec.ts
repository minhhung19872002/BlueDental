import { expect, test } from "@playwright/test";
import { login, runId } from "./fixtures/auth";
import { openExtraServiceDialog } from "./fixtures/extraService";
import { openDropdown, openNewSlip } from "./fixtures/ledgerReceipt";
import {
  browserFetch,
  createSaleService,
  LIST_PRICE,
  patientBranch,
  PLANS_API,
  SALE_PRICE,
  slipLines,
  vnd,
} from "./fixtures/saleService";

/**
 * R-1235 — "Thêm dịch vụ phát sinh" prices the service at Danh mục's "Giá sau
 * giảm", as Phiếu tư vấn and Chuyển đổi (R-1184) do: a 300.000 đ service with
 * 10% off reads, is written and is capped at 270.000 đ — the BA's "phần thêm
 * dịch vụ phát sinh chưa lấy giá sau giảm" (2026-11-15).
 *
 * Real stack: real login, real API, real PostgreSQL; the catalog entry and the
 * slip are written through the API with the browser's own session.
 */

const ABOVE_SALE = "Đơn giá không được lớn hơn giá gốc của dịch vụ.";

test("Thêm dịch vụ phát sinh sells the service at its Giá sau giảm and caps Đơn giá there", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await login(page);
  const { patientId, slip } = await openNewSlip(page);
  const branch = await patientBranch(page, patientId);

  const name = `e2e phát sinh giá sau giảm ${runId()}`;
  const entry = await createSaleService(page, branch, name);

  const dialog = await openExtraServiceDialog(page);
  await dialog.getByRole("combobox", { name: /Bác sĩ tư vấn(?! 2)/ }).click();
  const advisor = openDropdown(page).locator(".ant-select-item-option").first();
  await expect(advisor).toBeVisible();
  await advisor.click();

  const picker = dialog.getByRole("combobox", { name: /Thêm dịch vụ mới/ });
  await picker.click();
  await picker.pressSequentially(name);
  const option = openDropdown(page, ".tp-service-dropdown")
    .locator(".ant-select-item-option:has(.tp-opt-service)")
    .filter({ hasText: name });
  await expect(option).toHaveCount(1, { timeout: 15_000 });
  // The option offers the price the line will be written at.
  await expect(option.locator(".tp-opt-price")).toHaveText(vnd(SALE_PRICE));
  await option.click();

  // Đơn giá starts at the sale price; one unit, nothing taken off on top of it.
  const unitPrice = dialog.locator(".tp-create-money input").first();
  await expect(unitPrice).toHaveValue("270.000");
  const summary = dialog.locator(".tp-create-summary b");
  await expect(summary).toHaveText([vnd(SALE_PRICE), vnd(0), vnd(SALE_PRICE)]);

  // The sale price is the ceiling: above it the field refuses, at it the error goes.
  await unitPrice.fill("280000");
  await expect(dialog.getByText(ABOVE_SALE)).toBeVisible();
  await unitPrice.fill("270000");
  await expect(dialog.getByText(ABOVE_SALE)).toBeHidden();

  await dialog.locator(".tp-tooth-btn").click();
  const teeth = page.getByRole("dialog", { name: "Chọn răng" });
  await expect(teeth).toBeVisible();
  await teeth.getByRole("button", { name: "Răng 15", exact: true }).click();
  await teeth.locator(".tp-teeth-foot button").click();
  await expect(teeth).toBeHidden();

  const added = page.waitForResponse(
    (res) => /\/services$/.test(new URL(res.url()).pathname) && res.request().method() === "POST",
  );
  await dialog.getByRole("button", { name: "Lưu" }).click();
  const response = await added;
  expect(response.ok(), await response.text()).toBeTruthy();
  await expect(dialog).toBeHidden();

  // Read back on a separate request: written at 270.000 đ, and that is its giá gốc.
  const line = (await slipLines(page, branch, slip.id)).find((item) => item.serviceId === entry.id);
  expect(line).toBeDefined();
  expect(line!.price).toBe(SALE_PRICE);
  expect(line!.originalPrice).toBe(SALE_PRICE);
  expect(line!.effectiveAmount).toBe(SALE_PRICE);

  // The slip table, reloaded, prints the sale price and never the list price.
  await page.reload();
  const row = page.locator(".pdt-table tbody tr.ant-table-row", { hasText: name });
  await expect(row).toContainText(vnd(SALE_PRICE));
  await expect(row).not.toContainText(vnd(LIST_PRICE));

  // The server holds the same ceiling: the list price sent straight to the API
  // is refused (Treatment:0040), and nothing is added.
  const refused = await browserFetch<{ error: { code: string } }>(page, branch, {
    method: "POST",
    url: `${PLANS_API}/${slip.id}/services`,
    body: {
      serviceId: entry.id,
      price: LIST_PRICE,
      quantity: 1,
      discountType: 0,
      discountValue: 0,
      teeth: [{ toothCode: 16, selected: true }],
    },
  });
  expect(refused.status).toBe(403);
  expect(refused.body.error.code).toBe("BlueDental:Treatment:0040");
  const after = await slipLines(page, branch, slip.id);
  expect(after.filter((item) => item.serviceId === entry.id)).toHaveLength(1);
});
