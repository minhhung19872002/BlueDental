import { expect, test, type Page } from "@playwright/test";
import { login, runId } from "./fixtures/auth";
import {
  freshSlip,
  laboCatalog,
  orderBody,
  sentOrder,
  serviceLine,
  type LaboLine,
  type SpecService,
} from "./fixtures/laboApi";

/**
 * R-1318 (BA 2026-11-25): on the slip's Chi tiết điều trị table, "Phiếu Labo"
 * shows only when some line has a Labo order still standing, and "Bảo hành"
 * only when some line carries a Nha khoa or Labo chip. A slip of fillings alone
 * has neither; once one line needs them, the others read as before
 * ("Không áp dụng" / "–").
 *
 * Real stack only: real login, real API, real PostgreSQL; the lines and the
 * order are written through the API from the logged-in page, then the table is
 * read after a reload.
 */

/** Danh mục "Thời gian bảo hành (ngày)" = 365, as plan-warranty-api.spec.ts makes it. */
const WARRANTY_SERVICE: SpecService = { name: "DV BẢO HÀNH E2E", warrantyDays: 365 };

async function openSlip(page: Page, line: LaboLine) {
  await page.goto(`/patient/${line.patientId}/treatment-plan/${line.planId}?branchId=${line.branchId}&planTab=detail`);
  await expect(page.locator(`tr[data-row-key="${line.lineId}"]`)).toBeVisible();
}

async function headers(page: Page): Promise<string[]> {
  return (await page.locator(".pdt-table thead th").allInnerTexts()).map((text) => text.trim());
}

test.describe("R-1318 Phiếu Labo / Bảo hành only when a line fills them", () => {
  test("hidden on a plain slip, shown once a line has warranty days or a Labo order", async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 1600, height: 900 });
    await login(page);
    const id = runId();

    // A slip with one line of a service without warranty days and no Labo order.
    const plain = await serviceLine(page, { planId: await freshSlip(page, id) });
    await openSlip(page, plain);
    await expect.poll(() => headers(page)).toEqual([
      "Dịch vụ",
      "Bác sĩ điều trị",
      "Chẩn đoán",
      "Răng",
      "Trạng thái",
      "Đơn giá",
      "Giảm giá",
      "Thành tiền",
      "Thao tác",
    ]);
    await expect(page.locator(".pdt-labo-none, .pdt-wchip-none")).toHaveCount(0);

    // A line whose service carries warranty days: Bảo hành comes, Phiếu Labo stays away.
    const warranted = await serviceLine(page, { planId: plain.planId, service: WARRANTY_SERVICE });
    await openSlip(page, warranted);
    await expect.poll(() => headers(page)).toContain("Bảo hành");
    expect(await headers(page)).not.toContain("Phiếu Labo");
    await expect(page.locator(`tr[data-row-key="${warranted.lineId}"] .pdt-wchip--dental`)).toHaveText(
      "Nha khoa · Chưa đủ điều kiện",
    );
    await expect(page.locator(`tr[data-row-key="${plain.lineId}"] .pdt-wchip-none`)).toHaveText("–");

    // A Labo order on the plain line: Phiếu Labo comes after Trạng thái, Bảo hành after it.
    const catalog = await laboCatalog(page, plain.branchId, id);
    await sentOrder(page, orderBody(catalog, plain, id, { treatmentServiceId: plain.lineId }));
    await openSlip(page, plain);
    await expect.poll(() => headers(page)).toEqual([
      "Dịch vụ",
      "Bác sĩ điều trị",
      "Chẩn đoán",
      "Răng",
      "Trạng thái",
      "Phiếu Labo",
      "Bảo hành",
      "Đơn giá",
      "Giảm giá",
      "Thành tiền",
      "Thao tác",
    ]);
    // The line without an order still reads Không áp dụng (BA: "như hiện tại").
    await expect(page.locator(`tr[data-row-key="${warranted.lineId}"] .pdt-labo-none`)).toHaveText("Không áp dụng");
    await expect(page.locator(`tr[data-row-key="${plain.lineId}"] .pdt-wchip--labo`)).toBeVisible();
  });
});
