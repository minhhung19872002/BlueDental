import { expect, test, type Page } from "@playwright/test";
import { assertRealApiTraffic, login, runId } from "./fixtures/auth";
import { laboCatalog, orderBody, sentOrder } from "./fixtures/laboApi";
import { addPlanLine } from "./fixtures/laboSeed";

/**
 * Feature: hồ sơ bệnh nhân → tab Labo → "Xem chi tiết" on a row. Since
 * P2910_03 (F-85) the eye opens the one three-step Labo dialog; a sent order's
 * Đặt hàng tab reads it back locked, with "In Phiếu Labo" and the "PHIẾU ĐẶT
 * HÀNG LABO" sheet behind it (R-317). The old read-only "Thông tin chung"
 * modal is gone from this tab.
 *
 * Real stack: the browser logs in through the login screen and the tab reads
 * its rows from the real API. The order under test is created through the same
 * endpoint the dialog posts to, with the cookie the browser holds, so the sheet
 * has known values to print; the only browser-side shim is window.print, which
 * headless Chromium cannot open a preview for.
 */

/** The row whose Mã phiếu cell is exactly this code. */
function rowWithCode(page: Page, code: string) {
  return page
    .locator(".pd-pane--fill tbody tr.ant-table-row")
    .filter({ has: page.getByRole("cell", { name: code, exact: true }) })
    .first();
}

test.describe("Patient Labo tab — Xem chi tiết", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 900 });
    await login(page);
  });

  test("the eye opens the Labo dialog, and a sent order's Đặt hàng prints the sheet", async ({ page }) => {
    const id = runId();
    // A sent order hangs off a treatment line; a fresh one keeps the run apart.
    const target = await addPlanLine(page);
    const catalog = await laboCatalog(page, target.branchId, id);
    const body = orderBody(catalog, target, id, { teeth: [11, 12], treatmentServiceId: target.lineId });
    const sent = await sentOrder(page, body);
    const seeded = {
      orderCode: sent.orderCode,
      supplierName: catalog.supplierName,
      teeth: sent.toothNumbers ?? "11, 12",
      instruction: body.workDescription,
    };

    await page.goto(`/patient/${target.patientId}?branchId=${target.branchId}&tab=labo`);
    await assertRealApiTraffic(page, "/api/v1/app/labo-orders");

    // ── The row's first action is the eye ───────────────────────────────
    const row = rowWithCode(page, seeded.orderCode);
    await expect(row).toBeVisible();
    const actions = row.locator(".pd-icon-actions .ant-btn");
    await expect(actions.first()).toHaveAttribute("aria-label", "Xem chi tiết");
    await actions.first().click();

    // ── A sent order opens on its check; Đặt hàng reads back locked ─────
    const dialog = page.getByRole("dialog").filter({ has: page.locator(".pd-labo-steps") });
    await expect(dialog.getByRole("heading", { level: 2 })).toHaveText("Nhận hàng & kiểm tra");
    await dialog.getByRole("tab", { name: /Đặt hàng/ }).click();
    await expect(dialog.getByRole("heading", { level: 2 })).toHaveText("Đặt hàng");
    await expect(dialog.locator(`input[value="${seeded.orderCode}"]`)).toBeDisabled();
    // Nothing to send again: no Lưu nháp, no Tạo phiếu Labo.
    await expect(dialog.getByRole("button", { name: "Lưu nháp" })).toHaveCount(0);
    await expect(dialog.getByRole("button", { name: "Tạo phiếu Labo" })).toHaveCount(0);
    const printButton = dialog.getByRole("button", { name: "In Phiếu Labo" });
    await expect(printButton).toBeEnabled();
    const closeButton = dialog.locator(".pd-labo-step-footer").getByRole("button", { name: "Huỷ", exact: true });

    // ── The sheet sits on <body>, outside the modal, off-screen ──────────
    const sheet = page.locator("body > .pd-print-sheet .pd-labo-sheet");
    await expect(sheet).toHaveCount(1);
    await expect(sheet).toBeHidden();
    await expect(sheet.locator("h2")).toHaveText("PHIẾU ĐẶT HÀNG LABO");
    await expect(sheet).toContainText(`Số: ${seeded.orderCode}`);
    await expect(sheet).toContainText(`Mã KH: ${target.patientCode}`);
    await expect(sheet).toContainText(`Khách hàng: ${target.patientName}`);
    await expect(sheet).toContainText(`Nhà cung cấp: ${seeded.supplierName}`);
    await expect(sheet).toContainText(`Số răng: ${seeded.teeth}`);
    await expect(sheet).toContainText(`Nội dung chỉ định: ${seeded.instruction}`);
    // A missing value prints as a dash on paper.
    await expect(sheet).toContainText("Kiểu nhịp: —");
    await expect(sheet).toContainText("Người đặt hàng");
    await expect(sheet).toContainText("(Ký xác nhận)");

    // ── Printing: the body wears the print class and the file name, until
    //    the browser says it is done. Headless Chromium has no preview, so
    //    window.print is the one thing shimmed here. ────────────────────────
    await page.evaluate(() => {
      window.print = () => undefined;
    });
    await printButton.click();
    await expect(page.locator("body")).toHaveClass(/pd-printing/);
    await expect(page).toHaveTitle(`phieu-labo-${seeded.orderCode}`);
    await page.evaluate(() => window.dispatchEvent(new Event("afterprint")));
    await expect(page.locator("body")).not.toHaveClass(/pd-printing/);
    await expect(page).not.toHaveTitle(/phieu-labo/);

    // ── Đóng takes the modal and its sheet away ──────────────────────────
    await closeButton.click();
    await expect(dialog).toBeHidden();
    await expect(page.locator("body > .pd-print-sheet")).toHaveCount(0);
  });
});
