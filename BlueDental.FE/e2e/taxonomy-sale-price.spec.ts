import { expect, test, type Page } from "@playwright/test";
import { login, runId } from "./fixtures/auth";
import { BRANCH_ONE, ENTRIES, TAXONOMIES } from "./fixtures/catalogApi";
import { api, vnd } from "./fixtures/saleService";

/**
 * R-1239 (owner, 2026-11-16): Danh mục > Dịch vụ, column Giá. A service the
 * catalog discounts reads its list price struck through with the share off
 * beside it, and under them the "Giá sau giảm" every slip sells it at
 * (R-1235); a service without a discount reads its price alone, as before.
 *
 * Real stack: real login, real API, real PostgreSQL — nothing is intercepted.
 */

const CONFIG = {
  taxRate: 0, priceIncludesTax: false, requireImage: false, deductDoctorOnWarranty: false,
  separateRevenue: false, showToothOnInvoice: false, revenueByStage: false,
  requireStageSequence: false, warrantyDays: 0, laboSupplierIds: [],
};

interface Entry {
  id: string;
  name: string;
  price: number;
  serviceConfig: { priceAfterDiscount: number };
}

function service(page: Page, taxonomyId: string, name: string, price: number, discount: { percent: boolean; value: number }) {
  return api<Entry>(page, BRANCH_ONE, {
    method: "POST",
    url: ENTRIES,
    body: {
      clinicBranchId: BRANCH_ONE, taxonomyId, name, price, sortOrder: 0,
      serviceConfig: { ...CONFIG, discountIsPercent: discount.percent, discountValue: discount.value },
      stages: [],
    },
  });
}

test("Giá strikes the list price through over the Giá sau giảm, only when Danh mục discounts", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await login(page);
  await page.goto("/taxonomy/service");

  const id = runId();
  const group = await api<{ id: string }>(page, BRANCH_ONE, {
    method: "POST",
    url: TAXONOMIES,
    body: { clinicBranchId: BRANCH_ONE, group: "care_service", name: `DUNG-TEST Giá sau giảm ${id}`, sortOrder: 0 },
  });
  const percentOff = await service(page, group.id, `DUNG-TEST giảm 10% ${id}`, 300_000, { percent: true, value: 10 });
  const moneyOff = await service(page, group.id, `DUNG-TEST giảm tiền ${id}`, 15_000_000, { percent: false, value: 1_500_000 });
  const plain = await service(page, group.id, `DUNG-TEST không giảm ${id}`, 500_000, { percent: true, value: 0 });
  expect(percentOff.serviceConfig.priceAfterDiscount).toBe(270_000);
  expect(moneyOff.serviceConfig.priceAfterDiscount).toBe(13_500_000);
  expect(plain.serviceConfig.priceAfterDiscount).toBe(500_000);

  await page.goto(`/taxonomy/service?group=${group.id}`);
  const priceCell = (entry: Entry) =>
    page.locator("tr.ant-table-row", { hasText: entry.name }).locator(".bd-cat-sale, .bd-cat-price").first();

  // 10% off: 300.000 đ struck through, "-10%", then 270.000 đ in bold under it.
  const percentCell = priceCell(percentOff);
  await expect(percentCell.locator("s")).toHaveText(vnd(300_000));
  await expect(percentCell.locator(".bd-combo-off")).toHaveText("-10%");
  await expect(percentCell.locator(".bd-cat-price")).toHaveText(vnd(270_000));
  const wasBox = await percentCell.locator(".bd-combo-price-was").boundingBox();
  const saleBox = await percentCell.locator(".bd-cat-price").boundingBox();
  expect(saleBox!.y).toBeGreaterThan(wasBox!.y + wasBox!.height - 1);

  // An amount off reads as its share; eight digits keep the struck line on one line.
  const moneyCell = priceCell(moneyOff);
  await expect(moneyCell.locator("s")).toHaveText(vnd(15_000_000));
  await expect(moneyCell.locator(".bd-combo-off")).toHaveText("-10%");
  await expect(moneyCell.locator(".bd-cat-price")).toHaveText(vnd(13_500_000));
  const moneyWas = await moneyCell.locator(".bd-combo-price-was").boundingBox();
  expect(moneyWas!.height).toBeLessThan(24);

  // No discount: the price alone, nothing struck through.
  const plainRow = page.locator("tr.ant-table-row", { hasText: plain.name });
  await expect(plainRow.locator(".bd-cat-price")).toHaveText(vnd(500_000));
  await expect(plainRow.locator("s")).toHaveCount(0);

  // The discount taken off in Danh mục (a separate save), the cell goes plain after a reload.
  await api<Entry>(page, BRANCH_ONE, {
    method: "PUT",
    url: `${ENTRIES}/${percentOff.id}`,
    body: {
      taxonomyId: group.id, name: percentOff.name, price: 300_000, sortOrder: 0, isActive: true, isDeleted: false,
      serviceConfig: { ...CONFIG, discountIsPercent: true, discountValue: 0 },
      stages: [],
    },
  });
  await page.reload();
  const percentRow = page.locator("tr.ant-table-row", { hasText: percentOff.name });
  await expect(percentRow.locator(".bd-cat-price")).toHaveText(vnd(300_000));
  await expect(percentRow.locator("s")).toHaveCount(0);
});
