import { readFileSync } from "node:fs";
import { expect, test, type Download, type Page } from "@playwright/test";
import * as XLSX from "xlsx";
import { login } from "./fixtures/auth";

/**
 * Feature: Báo cáo (/report) — FE-only rebuild backed by mock data.
 *
 * The page mirrors the reference's four tabs. Every button must open its
 * dialog (or fire its demo toast) and nothing may be persisted, so the suite
 * asserts that no write request ever reaches the API while walking the page.
 */

const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const SHOT_DIR = "../reference-private/local";

/** Header row of the reference's "Thanh toán" workbook, in its column order. */
const PAYMENT_EXPORT_HEADERS = [
  "Ngày tạo",
  "Mã thanh toán",
  "Người tạo",
  "Mã khách hàng",
  "Tên khách hàng",
  "Mã phiếu điều trị",
  "Chi nhánh",
  "Dịch vụ điều trị",
  "Tổng tiền phiếu",
  "Thanh toán",
  "Tổng tạm ứng còn lại",
  "Thực thu",
  "Phương thức thanh toán",
  "Thông tin thanh toán",
  "Ghi chú",
];

/** Header row of the reference's "Hoàn tiền" workbook, in its column order. */
const REFUND_EXPORT_HEADERS = [
  "Ngày tạo",
  "Mã hoàn tiền",
  "Mã khách hàng",
  "Tên khách hàng",
  "Dịch vụ điều trị",
  "Tổng hoàn",
  "Ghi chú",
];

function trackWrites(page: Page): string[] {
  const writes: string[] = [];
  page.on("request", (req) => {
    if (WRITE_METHODS.has(req.method()) && req.url().includes("/api/")) {
      writes.push(`${req.method()} ${req.url()}`);
    }
  });
  return writes;
}

async function openReport(page: Page): Promise<string[]> {
  await login(page);
  const writes = trackWrites(page);
  await page.goto("/report");
  await expect(pillTab(page, "Doanh số và lượt khách")).toBeVisible();
  await expect(page.locator("body")).not.toContainText("Unexpected Application Error");
  return writes;
}

async function expectDemoToast(page: Page): Promise<void> {
  await expect(page.getByText("bản demo, chưa lưu dữ liệu").first()).toBeVisible();
}

function pillTab(page: Page, name: string) {
  return page.getByRole("tab", { name, exact: true }).first();
}

function dialog(page: Page) {
  return page.locator(".ant-modal").filter({ visible: true }).first();
}

async function closeDialog(page: Page): Promise<void> {
  await dialog(page).locator(".ant-modal-close").click();
  await expect(dialog(page)).toBeHidden();
}

/**
 * Rows of the first sheet of a downloaded workbook, header row first.
 * The xlsx ESM build has no readFile, so the bytes come in through node:fs.
 */
async function workbookRows(download: Download): Promise<(string | number)[][]> {
  const workbook = XLSX.read(readFileSync(await download.path()), { type: "buffer" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json<(string | number)[]>(sheet, { header: 1 });
}

/** Waits for spinners and open/close animations to finish, then captures. */
async function shot(page: Page, name: string, fullPage = false): Promise<void> {
  await expect(page.locator(".ant-spin-spinning")).toHaveCount(0);
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${SHOT_DIR}/${name}.png`, fullPage });
}

test.describe("Báo cáo", () => {
  test("tab Doanh số và lượt khách: bốn sub tab, đổi kỳ, xuất Excel — không ghi dữ liệu", async ({ page }) => {
    const writes = await openReport(page);

    await expect(pillTab(page, "Doanh số và lượt khách")).toBeVisible();
    await expect(page.getByText("Doanh số", { exact: true }).first()).toBeVisible();
    await shot(page, "report-tab1-service", true);

    for (const mode of ["Ngày", "Tuần", "Năm", "Tháng"]) {
      await page.locator(".ant-segmented-item-label", { hasText: mode }).first().click();
      await expect(page.locator(".ant-segmented-item-selected")).toContainText(mode);
    }

    const downloadPromise = page.waitForEvent("download", { timeout: 10_000 });
    await page.getByRole("button", { name: "Xuất Excel" }).first().click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.xlsx$/);

    await pillTab(page, "Thanh toán").click();
    await expect(page.getByText("Thực thu", { exact: true }).first()).toBeVisible();
    await shot(page, "report-tab1-payment", true);

    // The payment workbook is wider than the on-screen table: it must carry the
    // reference's 15 columns in order, with amounts as numbers rather than text.
    const paymentDownload = page.waitForEvent("download", { timeout: 10_000 });
    await page.getByRole("button", { name: "Xuất Excel" }).first().click();
    const rows = await workbookRows(await paymentDownload);
    expect(rows[0]).toEqual(PAYMENT_EXPORT_HEADERS);
    expect(rows.length).toBeGreaterThan(1);
    const [, firstRow] = rows;
    expect(firstRow[0]).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
    expect(firstRow[1]).toMatch(/^THANHTOAN-/);
    for (const amountColumn of [8, 9, 10, 11]) {
      expect(typeof firstRow[amountColumn]).toBe("number");
    }
    // The page scrolls inside the layout, so a tall viewport is the only way to capture the charts.
    await page.setViewportSize({ width: 1280, height: 2600 });
    await shot(page, "report-tab1-payment-tall");
    await page.setViewportSize({ width: 1280, height: 720 });

    await pillTab(page, "Hoàn tiền").click();
    await expect(page.locator(".ant-table").first()).toBeVisible();
    await shot(page, "report-tab1-refund", true);

    // The refund workbook reorders and renames columns relative to the table.
    const refundDownload = page.waitForEvent("download", { timeout: 10_000 });
    await page.getByRole("button", { name: "Xuất Excel" }).first().click();
    const refundRows = await workbookRows(await refundDownload);
    expect(refundRows[0]).toEqual(REFUND_EXPORT_HEADERS);
    expect(refundRows.length).toBeGreaterThan(1);
    const [, firstRefund] = refundRows;
    expect(firstRefund[0]).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
    expect(firstRefund[1]).toMatch(/^HOANTIEN-/);
    expect(typeof firstRefund[5]).toBe("number");

    await pillTab(page, "Dư nợ").click();
    await expect(page.getByText("Dư nợ phát sinh").first()).toBeVisible();
    await shot(page, "report-tab1-debt", true);

    expect(writes).toEqual([]);
  });

  test("tab Quản lý thu chi: thêm / sửa / duyệt / từ chối / xóa đều mở dialog và chỉ hiện toast demo", async ({ page }) => {
    const writes = await openReport(page);
    await pillTab(page, "Quản lý thu chi").click();
    await expect(page.getByText("Tổng doanh thu").first()).toBeVisible();
    await shot(page, "report-tab2-income", true);

    // Thêm mới → dialog "Thêm khoản thu", cancel keeps nothing.
    await page.getByRole("button", { name: "Thêm mới" }).click();
    await expect(dialog(page)).toContainText("Thêm khoản thu");
    await shot(page, "report-tab2-modal-create");
    await closeDialog(page);

    // Submitting the create form validates locally, then only toasts.
    await page.getByRole("button", { name: "Thêm mới" }).click();
    await dialog(page).getByRole("button", { name: "Lưu" }).click();
    await expect(dialog(page).locator(".ant-form-item-explain-error").first()).toBeVisible();
    await closeDialog(page);

    const firstRow = page.locator(".ant-table-row").first();
    await firstRow.getByRole("button", { name: "edit" }).click();
    await expect(dialog(page)).toContainText("Sửa khoản thu");
    await closeDialog(page);

    await firstRow.getByRole("button", { name: "delete" }).click();
    await expect(dialog(page)).toContainText("Xác nhận xoá phiếu");
    await dialog(page).getByRole("button", { name: "Xoá" }).click();
    await expectDemoToast(page);

    // Chi phí sub tab keeps the same actions plus the approval column.
    await pillTab(page, "Chi phí").click();
    await expect(page.getByText("Tổng chi phí").first()).toBeVisible();
    await page.getByRole("button", { name: "Thêm mới" }).click();
    await expect(dialog(page)).toContainText("Thêm chi phí");
    await expect(dialog(page).getByText("Chọn khách hàng")).toHaveCount(0);
    await shot(page, "report-tab2-modal-expense");
    await closeDialog(page);
    await shot(page, "report-tab2-expense", true);

    // Only expense vouchers carry an approval status; a pending row exposes Duyệt / Từ chối.
    const pendingRow = page.locator(".ant-table-row").filter({ hasText: "Chờ duyệt" }).first();
    await expect(pendingRow).toBeVisible();
    await pendingRow.getByRole("button", { name: "check" }).click();
    await expect(page.getByText(/Duyệt phiếu .* bản demo/).first()).toBeVisible();
    await pendingRow.getByRole("button", { name: "close" }).click();
    await expect(dialog(page)).toContainText("Lý do từ chối");
    await dialog(page).getByRole("button", { name: "Từ chối" }).click();
    await expect(dialog(page).locator(".ant-form-item-explain-error")).toBeVisible();
    await closeDialog(page);


    // Danh mục sub tab: sidebar switch + add/edit/delete dialogs.
    await pillTab(page, "Danh mục").click();
    await expect(page.getByText("Danh mục thu nhập").first()).toBeVisible();
    await page.getByRole("button", { name: "Thêm mục" }).click();
    await expect(dialog(page)).toContainText("Thêm danh mục thu nhập");
    await shot(page, "report-tab2-modal-category");
    await closeDialog(page);
    await page.getByRole("button", { name: "Danh mục chi phí" }).click();
    await page.getByRole("button", { name: "Thêm mục" }).click();
    await expect(dialog(page)).toContainText("Thêm danh mục chi phí");
    await closeDialog(page);
    await page.locator(".ant-table-row").first().getByRole("button", { name: "delete" }).click();
    await expect(dialog(page)).toContainText("Xác nhận xoá danh mục");
    await dialog(page).getByRole("button", { name: "Xoá" }).click();
    await expectDemoToast(page);
    await shot(page, "report-tab2-category", true);

    expect(writes).toEqual([]);
  });

  test("tab Kết quả kinh doanh và Luân chuyển dòng tiền V2 — nạp / rút / luân chuyển chỉ toast demo", async ({ page }) => {
    const writes = await openReport(page);

    await pillTab(page, "Kết quả kinh doanh").click();
    await expect(page.getByText("Doanh thu tổng")).toBeVisible();
    await expect(page.getByText("Hoàn tiền từ dịch vụ điều trị")).toBeVisible();
    await expect(page.getByText("Bác sĩ điều trị")).toHaveCount(0);
    await shot(page, "report-tab3-result", true);

    await pillTab(page, "Luân chuyển dòng tiền V2").click();
    await expect(page.getByText("Tổng Tiền Mặt")).toBeVisible();
    await expect(page.getByText("Doanh thu dịch vụ")).toBeVisible();
    await shot(page, "report-tab4-overview", true);

    await page.getByRole("button", { name: "Nạp" }).click();
    await expect(dialog(page)).toContainText("Tạo giao dịch nạp");
    await shot(page, "report-tab4-modal-deposit");
    await dialog(page).getByLabel(/Số tiền/).fill("1500000");
    await dialog(page).getByRole("button", { name: "Lưu" }).click();
    await expect(page.getByText(/Tạo giao dịch nạp .* bản demo/).first()).toBeVisible();

    await page.getByRole("button", { name: "Rút" }).click();
    await expect(dialog(page)).toContainText("Tạo giao dịch rút");
    await expect(dialog(page)).toContainText("Số dư khả dụng");
    await shot(page, "report-tab4-modal-withdraw");
    await closeDialog(page);

    await page.getByRole("button", { name: "Luân chuyển" }).click();
    await expect(dialog(page)).toContainText("Tạo giao dịch luân chuyển");
    await expect(dialog(page).getByText("Luân chuyển đến")).toBeVisible();
    await shot(page, "report-tab4-modal-transfer");
    await closeDialog(page);

    const firstRow = page.locator(".ant-table-row").first();
    await firstRow.getByRole("button", { name: "edit" }).click();
    await expect(dialog(page)).toContainText("Sửa giao dịch");
    await closeDialog(page);
    await firstRow.getByRole("button", { name: "delete" }).click();
    await expect(dialog(page)).toContainText("Xác nhận xoá giao dịch");
    await dialog(page).getByRole("button", { name: "Xoá" }).click();
    await expectDemoToast(page);

    await pillTab(page, "Danh mục").click();
    await expect(page.getByText("Danh mục sổ quỹ")).toBeVisible();
    await page.getByRole("button", { name: "Thêm mục" }).click();
    await expect(dialog(page)).toContainText("Thêm danh mục sổ quỹ");
    await closeDialog(page);
    await shot(page, "report-tab4-category", true);

    expect(writes).toEqual([]);
  });

  test("responsive: không tràn ngang ở 390px và dialog vẫn dùng được", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openReport(page);

    const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(await overflow()).toBeLessThanOrEqual(0);
    await shot(page, "report-mobile-tab1", true);

    await pillTab(page, "Quản lý thu chi").click();
    await expect(page.getByText("Tổng doanh thu").first()).toBeVisible();
    expect(await overflow()).toBeLessThanOrEqual(0);
    await page.getByRole("button", { name: "Thêm mới" }).click();
    await expect(dialog(page)).toContainText("Thêm khoản thu");
    await shot(page, "report-mobile-modal");
    await closeDialog(page);

    await pillTab(page, "Luân chuyển dòng tiền V2").click();
    await expect(page.getByText("Tổng Tiền Mặt")).toBeVisible();
    expect(await overflow()).toBeLessThanOrEqual(0);
    await shot(page, "report-mobile-tab4", true);
  });
});
