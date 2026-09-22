import { readFileSync } from "node:fs";
import { expect, test, type Download, type Locator, type Page } from "@playwright/test";
import * as XLSX from "xlsx";
import { assertRealApiTraffic, login, runId } from "./fixtures/auth";

/**
 * Feature: Báo cáo (/report) — F-17 (Quản lý thu chi), F-18 (Luân chuyển dòng
 * tiền V2), F-04/F-05 (Doanh số và lượt khách, Kết quả kinh doanh).
 *
 * Everything here drives the real API: real login, real PostgreSQL, no route
 * interception. Each test owns its data through a run id, and undoes what it
 * created so the balances end where they started. Every Excel export is opened
 * and checked against the reference's workbook layout.
 */

const SHOT_DIR = "../reference-private/local";

/** Header row of the reference's "Thanh toán" workbook (server-generated). */
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

/** Header row of the reference's "Hoàn tiền" workbook (server-generated). */
const REFUND_EXPORT_HEADERS = [
  "Ngày tạo",
  "Mã hoàn tiền",
  "Mã khách hàng",
  "Tên khách hàng",
  "Dịch vụ điều trị",
  "Tổng hoàn",
  "Ghi chú",
];

/*
 * The three client-side workbooks (tab 2 income / expense, tab 4 ledger) copy
 * the reference file byte for byte in layout: a merged title in row 1, a blank
 * row 2, the headers in row 3, fixed column widths, numeric amounts.
 */
const INCOME_EXPORT = {
  filename: "thu-nhap.xlsx",
  sheet: "Thu nhập",
  title: "Báo cáo thu nhập",
  headers: ["Ngày tạo", "Khách hàng", "Nội dung thu", "Nhân viên thu", "Mục thu", "Doanh thu", "Hình thức"],
  widths: [16, 22, 28, 18, 18, 18, 16],
};

const EXPENSE_EXPORT = {
  filename: "chi-phi.xlsx",
  sheet: "Chi phí",
  title: "Báo cáo chi phí",
  headers: ["Ngày tạo", "Ngày thực chi", "Nội dung", "Khách hàng", "Nhân viên", "Mục chi", "Tổng tiền", "Hình thức", "Trạng thái"],
  widths: [16, 16, 28, 18, 18, 18, 18, 16, 14],
};

const LEDGER_EXPORT = {
  filename: "luan-chuyen-dong-tien.xlsx",
  sheet: "Luân chuyển dòng tiền",
  title: "Báo cáo luân chuyển dòng tiền",
  headers: ["Ngày", "Loại giao dịch", "Hình thức", "Danh mục", "Số tiền", "Người tạo", "Ghi chú"],
  widths: [16, 18, 20, 18, 18, 18, 28],
};

type ClientExport = typeof INCOME_EXPORT;

const DATE_CELL = /^\d{2}\/\d{2}\/\d{4}$/;

function pillTab(page: Page, name: string) {
  return page.getByRole("tab", { name, exact: true }).first();
}

/** Clicks a pill and waits until it is the selected one (the thumb re-measures on click). */
async function selectPill(page: Page, name: string): Promise<void> {
  await expect(async () => {
    await pillTab(page, name).click();
    await expect(pillTab(page, name)).toHaveAttribute("aria-selected", "true", { timeout: 2_000 });
  }).toPass({ timeout: 15_000 });
}

function dialog(page: Page) {
  return page.locator(".ant-modal").filter({ visible: true }).first();
}

async function closeDialog(page: Page): Promise<void> {
  await dialog(page).locator(".ant-modal-close").click();
  await expect(dialog(page)).toBeHidden();
}

function tableRow(page: Page, text: string) {
  return page.locator(".ant-table-row").filter({ hasText: text });
}

async function expectToast(page: Page, text: string): Promise<void> {
  await expect(page.getByText(text, { exact: true }).first()).toBeVisible();
}

/** "1.500.000 đ\nTổng doanh thu" under the icon card -> 1500000. */
async function readAmount(page: Page, label: string): Promise<number> {
  const text = await page.getByText(label, { exact: true }).first().locator("..").innerText();
  const digits = text.replace(label, "").replace(/[^\d]/g, "");
  return digits ? Number(digits) : 0;
}

/**
 * SearchSelect has no id, so its floating label cannot be resolved through
 * getByLabel: scope by the wrapper that carries the label instead.
 */
async function pickSearchOption(page: Page, scope: Locator, label: string, optionText: string): Promise<void> {
  await scope.locator(".floating-field").filter({ hasText: label }).getByRole("combobox").click();
  const dropdown = page.locator("#ss-portal-dropdown");
  await dropdown.getByPlaceholder("Tìm kiếm...").fill(optionText);
  await dropdown.getByRole("option", { name: optionText, exact: true }).click();
  await expect(dropdown).toBeHidden();
}

/** Opens a SearchSelect by its floating label and checks the exact option list, then closes it. */
async function expectSearchOptions(page: Page, scope: Locator, label: string, options: string[]): Promise<void> {
  await scope.locator(".floating-field").filter({ hasText: label }).getByRole("combobox").click();
  const dropdown = page.locator("#ss-portal-dropdown");
  await expect(dropdown.getByPlaceholder("Tìm kiếm...")).toBeVisible();
  await expect(dropdown.getByRole("option")).toHaveText(options);
  // Escape would bubble to the modal and close it; an outside click only closes the list.
  await scope.locator(".ant-modal-title").click();
  await expect(dropdown).toBeHidden();
}

function antSelectIn(scope: Locator, label: string) {
  return scope.locator(".floating-field").filter({ hasText: label }).locator(".ant-select").first();
}

/** Opens an AntD Select by its floating label and checks the exact option list, then closes it. */
async function expectSelectOptions(page: Page, scope: Locator, label: string, options: string[]): Promise<void> {
  await antSelectIn(scope, label).click();
  const dropdown = page.locator(".ant-select-dropdown:visible").first();
  await expect(dropdown.locator(".ant-select-item-option-content")).toHaveText(options);
  await page.keyboard.press("Escape");
  await expect(dropdown).toBeHidden();
}

async function pickSelectOption(page: Page, scope: Locator, label: string, optionText: string): Promise<void> {
  await antSelectIn(scope, label).click();
  const dropdown = page.locator(".ant-select-dropdown:visible").first();
  await dropdown.locator(".ant-select-item-option-content", { hasText: optionText }).first().click();
  await expect(dropdown).toBeHidden();
}

interface Workbook {
  sheetName: string;
  rows: (string | number)[][];
  widths: number[];
  merges: number;
}

/** First sheet of a downloaded workbook. The xlsx ESM build has no readFile. */
async function readWorkbook(download: Download): Promise<Workbook> {
  // cellStyles is what makes SheetJS keep the <cols> widths on read.
  const workbook = XLSX.read(readFileSync(await download.path()), { type: "buffer", cellStyles: true });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  return {
    sheetName,
    rows: XLSX.utils.sheet_to_json<(string | number)[]>(sheet, { header: 1, blankrows: true }),
    widths: (sheet["!cols"] ?? []).map((c) => c.wch ?? 0),
    merges: (sheet["!merges"] ?? []).length,
  };
}

async function exportCurrentView(page: Page): Promise<Download> {
  const downloadPromise = page.waitForEvent("download", { timeout: 10_000 });
  await page.getByRole("button", { name: "Xuất Excel" }).first().click();
  return downloadPromise;
}

/** Title row, blank row, header row, widths, merged title — then the data rows. */
async function expectClientExport(page: Page, spec: ClientExport): Promise<(string | number)[][]> {
  const download = await exportCurrentView(page);
  expect(download.suggestedFilename()).toBe(spec.filename);
  await expectToast(page, "Xuất Excel thành công");

  const workbook = await readWorkbook(download);
  expect(workbook.sheetName).toBe(spec.sheet);
  expect(workbook.rows[0]).toEqual([spec.title]);
  expect(workbook.rows[1]).toEqual([]);
  expect(workbook.rows[2]).toEqual(spec.headers);
  expect(workbook.widths).toEqual(spec.widths);
  expect(workbook.merges).toBe(1);
  return workbook.rows.slice(3);
}

/** Waits for spinners and open/close animations to finish, then captures. */
async function shot(page: Page, name: string, fullPage = false): Promise<void> {
  await expect(page.locator(".ant-spin-spinning")).toHaveCount(0);
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${SHOT_DIR}/${name}.png`, fullPage });
}

/** Opens a report tab and proves its first read went to the real backend. */
async function openReport(page: Page, query: string, apiFragment: string): Promise<void> {
  const traffic = assertRealApiTraffic(page, apiFragment);
  await page.goto(`/report${query}`);
  await traffic;
  await expect(page.locator("body")).not.toContainText("Unexpected Application Error");
}

async function createSalesCategory(page: Page, panel: "Danh mục thu nhập" | "Danh mục chi phí", name: string): Promise<void> {
  await page.getByRole("button", { name: panel }).click();
  await page.getByRole("button", { name: "Thêm mục" }).click();
  await expect(dialog(page)).toContainText(panel.replace("Danh mục", "Thêm danh mục"));
  await dialog(page).getByLabel("Tên phân loại").fill(name);
  await dialog(page).getByRole("button", { name: "Lưu" }).click();
  await expectToast(page, "Tạo nhóm thành công");
  await expect(tableRow(page, name)).toBeVisible();
}

/**
 * Sales categories toast "Đã xoá nhóm" on the reference and title the dialog
 * "Xác nhận xoá" (staging screenshot); the cash-book ones "Đã xoá danh mục" /
 * "Xác nhận xoá danh mục".
 */
async function deleteCategory(page: Page, name: string, toast = "Đã xoá nhóm", title = "Xác nhận xoá"): Promise<void> {
  await tableRow(page, name).getByRole("button", { name: "delete" }).click();
  await expect(dialog(page).locator(".bd-modal-title")).toHaveText(title);
  await expect(dialog(page)).toContainText(`Bạn có chắc muốn xoá danh mục ${name} không?`);
  await dialog(page).getByRole("button", { name: "Xoá" }).click();
  await expectToast(page, toast);
  await expect(tableRow(page, name)).toHaveCount(0);
}

/** Only a pending expense carries the red Xoá button (reference: income and approved rows do not). */
async function deleteVoucher(page: Page, description: string): Promise<void> {
  await tableRow(page, description).getByRole("button", { name: "Xoá" }).click();
  await expect(dialog(page)).toContainText("Xác nhận xoá");
  await expect(dialog(page)).toContainText(`Bạn có chắc muốn xoá phiếu chi ${description} không?`);
  await dialog(page).getByRole("button", { name: "Xoá" }).click();
  await expectToast(page, "Đã xoá phiếu thu chi");
  await expect(tableRow(page, description)).toHaveCount(0);
}

/** The printer button opens the reference's "Chi tiết phiếu" preview (no network). */
async function expectPrintPreview(page: Page, description: string, printLabel: string): Promise<void> {
  // The row button carries the same label as the preview button ("In khoản thu" / "In chi phí").
  await tableRow(page, description).getByRole("button", { name: printLabel, exact: true }).click();
  await expect(dialog(page)).toContainText("Chi tiết phiếu");
  await expect(dialog(page)).toContainText("THÔNG TIN PHÒNG KHÁM");
  await expect(dialog(page)).toContainText("KHÁCH HÀNG");
  await expect(dialog(page)).toContainText(description);
  await expect(dialog(page)).toContainText("Tổng cộng");
  await expect(dialog(page).getByRole("button", { name: printLabel })).toBeVisible();
  await dialog(page).locator(".ant-modal-close").click();
  await expect(dialog(page)).toBeHidden();
}

/** The eye button opens the reference's tab-4 "Chi tiết phiếu" voucher (no network). */
async function expectVoucherPreview(page: Page, note: string, heading: string): Promise<void> {
  await tableRow(page, note).getByRole("button", { name: "Xem chi tiết" }).click();
  await expect(dialog(page)).toContainText("Chi tiết phiếu");
  await expect(dialog(page)).toContainText(heading);
  await expect(dialog(page)).toContainText("Ngày thực hiện");
  await expect(dialog(page)).toContainText("Bằng chữ");
  await expect(dialog(page)).toContainText("Người lập phiếu");
  await expect(dialog(page)).toContainText(note);
  await expect(dialog(page).getByRole("button", { name: "In Hoá Đơn" })).toBeVisible();
  await dialog(page).locator(".ant-modal-close").click();
  await expect(dialog(page)).toBeHidden();
}

async function deleteLedgerEntry(page: Page, note: string): Promise<void> {
  await tableRow(page, note).getByRole("button", { name: "Hủy", exact: true }).click();
  await expect(dialog(page)).toContainText("Xác nhận hủy giao dịch");
  await expect(dialog(page)).toContainText(`Bạn có chắc muốn hủy giao dịch ${note} không?`);
  await dialog(page).getByRole("button", { name: "Hủy giao dịch" }).click();
  await expectToast(page, "Đã hủy giao dịch");
  await expect(tableRow(page, note)).toHaveCount(0);
}

test.describe("Báo cáo", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("tab Doanh số và lượt khách: năm sub tab, đổi kỳ, xuất Excel đúng cột tham chiếu", async ({ page }) => {
    await openReport(page, "", "/api/v1/app/clinic-reports/");

    await expect(pillTab(page, "Doanh số và lượt khách")).toBeVisible();
    await expect(page.getByText("Doanh số", { exact: true }).first()).toBeVisible();
    await shot(page, "report-tab1-service", true);

    // The reference opens on "Ngày" and always writes the period into the URL.
    await expect(page).toHaveURL(/report_dateMode=day&report_date=\d{4}-\d{2}-\d{2}/);
    // Ends on Tháng so the exports below cover the seeded month, not just today.
    for (const [mode, value] of [["Ngày", "day"], ["Tuần", "week"], ["Năm", "year"], ["Tháng", "month"]]) {
      await page.locator(".ant-segmented-item-label", { hasText: mode }).first().click();
      await expect(page.locator(".ant-segmented-item-selected")).toContainText(mode);
      await expect(page).toHaveURL(new RegExp(`report_dateMode=${value}`));
    }

    const serviceDownload = await exportCurrentView(page);
    expect(serviceDownload.suggestedFilename()).toMatch(/\.xlsx$/);

    // "Doanh số thực" is the reference's second pill: one plan-line table, no charts.
    await selectPill(page, "Doanh số thực");
    await expect(page.getByText("Doanh số thực", { exact: true }).nth(1)).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Kế hoạch điều trị" })).toBeVisible();
    await expect(page.getByText("Thực thu và công nợ")).toHaveCount(0);

    await selectPill(page, "Thanh toán");
    await expect(page.getByText("Thực thu", { exact: true }).first()).toBeVisible();
    await shot(page, "report-tab1-payment", true);

    // The payment workbook is wider than the on-screen table: it must carry the
    // reference's 15 columns in order, with amounts as numbers rather than text.
    const payment = await readWorkbook(await exportCurrentView(page));
    expect(payment.rows[0]).toEqual(PAYMENT_EXPORT_HEADERS);
    expect(payment.rows.length).toBeGreaterThan(1);
    const [, firstPayment] = payment.rows;
    expect(firstPayment[0]).toMatch(DATE_CELL);
    // Reference code shape: THANHTOAN-<seq>/DT<plan seq>/<year>.
    expect(String(firstPayment[1])).toMatch(/^THANHTOAN-\d{2,}\/DT\d{2,}\/\d{4}$/);
    for (const amountColumn of [8, 9, 10, 11]) {
      expect(typeof firstPayment[amountColumn]).toBe("number");
    }
    // The page scrolls inside the layout, so a tall viewport is the only way to capture the charts.
    await page.setViewportSize({ width: 1280, height: 2600 });
    await shot(page, "report-tab1-payment-tall");
    await page.setViewportSize({ width: 1280, height: 720 });

    await selectPill(page, "Hoàn tiền");
    await expect(page.locator(".ant-table").first()).toBeVisible();
    await shot(page, "report-tab1-refund", true);

    // The refund workbook reorders and renames columns relative to the table.
    const refund = await readWorkbook(await exportCurrentView(page));
    expect(refund.rows[0]).toEqual(REFUND_EXPORT_HEADERS);
    expect(refund.rows.length).toBeGreaterThan(1);
    const [, firstRefund] = refund.rows;
    expect(firstRefund[0]).toMatch(DATE_CELL);
    expect(String(firstRefund[1])).toMatch(/\S/);
    expect(typeof firstRefund[5]).toBe("number");

    await selectPill(page, "Dư nợ");
    await expect(page.getByText("Dư nợ phát sinh").first()).toBeVisible();
    await shot(page, "report-tab1-debt", true);

    // Tạm ứng is a ledger view like Dư nợ: tiles + pill + table, no overview charts.
    // Year view, like the staging screenshot, so the seeded deposits are in range.
    await page.locator(".ant-segmented-item-label", { hasText: "Năm" }).first().click();
    await expect(page).toHaveURL(/report_dateMode=year/);
    await selectPill(page, "Tạm ứng");
    for (const tile of ["Tạm ứng phát sinh", "Tiêu dùng tạm ứng", "Hoàn tiền tạm ứng", "Số dư tạm ứng hiện tại"]) {
      await expect(page.locator(".report-stat-tile-label", { hasText: tile })).toBeVisible();
    }
    await expect(page.getByRole("columnheader", { name: "Loại sự kiện" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Số dư sau" })).toBeVisible();
    await expect(page.getByText("Thông tin lượt khách", { exact: true })).toHaveCount(0);
    // A deposit row shows its own voucher (staging: THANHTOAN-31/DT32/2026 on a slip;
    // a slip-less local top-up keeps the TAMUNG assumption) and a signed, coloured amount.
    const depositRow = tableRow(page, "Tạm ứng phát sinh").first();
    await expect(depositRow.locator(".report-voucher-code")).toHaveText(/^(THANHTOAN|TAMUNG)-\d{2,}\//);
    await expect(depositRow.locator(".report-money--green")).toHaveText(/^\+[\d.]+ đ$/);
    await expect(depositRow.locator(".report-money--blue")).toHaveText(/^[\d.]+ đ$/);
    await shot(page, "report-tab1-prepaid", true);
  });

  test("tab Quản lý thu chi: danh mục, khoản thu, chi phí duyệt / xoá, in phiếu, xuất Excel — dữ liệu thật", async ({ page }) => {
    const id = runId();
    const incomeCategory = `Mục thu E2E ${id}`;
    const expenseCategory = `Mục chi E2E ${id}`;
    const scratchCategory = `Mục tạm E2E ${id}`;
    const incomeDescription = `Thu E2E ${id}`;
    const expenseDescription = `Chi E2E ${id}`;
    const pendingDescription = `Chi dự E2E ${id}`;

    // Day period: only vouchers created today are listed, so the new rows sit on page 1.
    await openReport(page, "?reportTab=cashflow&report_dateMode=day", "/api/v1/app/sales");
    await expect(page.getByText("Tổng doanh thu").first()).toBeVisible();

    // --- Danh mục: the vouchers below need a category of each type. ---
    await selectPill(page, "Danh mục");
    await expect(page.getByText("Danh mục thu nhập").first()).toBeVisible();
    await createSalesCategory(page, "Danh mục thu nhập", incomeCategory);
    await createSalesCategory(page, "Danh mục chi phí", expenseCategory);
    await shot(page, "report-tab2-category", true);

    // A throwaway category proves edit and delete without touching the ones in use.
    await createSalesCategory(page, "Danh mục chi phí", scratchCategory);
    await tableRow(page, scratchCategory).getByRole("button", { name: "edit" }).click();
    await expect(dialog(page)).toContainText("Chỉnh sửa danh mục chi phí");
    await dialog(page).getByLabel("Tên phân loại").fill(`${scratchCategory} sửa`);
    await dialog(page).getByRole("button", { name: "Lưu" }).click();
    await expectToast(page, "Cập nhật nhóm thành công");
    await expect(tableRow(page, `${scratchCategory} sửa`)).toBeVisible();
    await deleteCategory(page, `${scratchCategory} sửa`);

    // --- Thu nhập: validation, create, persistence, edit, export, delete. ---
    await selectPill(page, "Thu nhập");
    await expect(page.getByText("Tổng doanh thu").first()).toBeVisible();
    const incomeBefore = await readAmount(page, "Tổng doanh thu");

    await page.getByRole("button", { name: "Thêm mới" }).click();
    await expect(dialog(page)).toContainText("Thêm khoản thu");
    await shot(page, "report-tab2-modal-create");
    await dialog(page).getByRole("button", { name: "Lưu" }).click();
    await expect(dialog(page).getByText("Vui lòng nhập số tiền")).toBeVisible();
    await expect(dialog(page).getByText("Mục thu là trường bắt buộc.")).toBeVisible();

    // Hình thức is the reference's searchable four-item list.
    await expectSearchOptions(page, dialog(page), "Hình thức", ["Tiền mặt", "Chuyển khoản", "Quẹt thẻ", "Dư nợ"]);
    await dialog(page).getByLabel("Số tiền").fill("1500000");
    await pickSearchOption(page, dialog(page), "Mục thu", incomeCategory);
    await dialog(page).getByLabel("Nội dung thu").fill(incomeDescription);
    await dialog(page).getByRole("button", { name: "Lưu" }).click();
    await expect(dialog(page)).toBeHidden();

    const incomeRow = tableRow(page, incomeDescription);
    await expect(incomeRow).toBeVisible();
    await expect(incomeRow).toContainText("1.500.000");
    await expect(incomeRow).toContainText(incomeCategory);
    await expect(incomeRow).toContainText("Tiền mặt");
    await expect.poll(() => readAmount(page, "Tổng doanh thu")).toBe(incomeBefore + 1_500_000);
    await shot(page, "report-tab2-income", true);

    // Persisted, not cached: a fresh load still lists it.
    await page.reload();
    await expect(tableRow(page, incomeDescription)).toBeVisible();

    await tableRow(page, incomeDescription).getByRole("button", { name: "Chỉnh sửa" }).click();
    await expect(dialog(page)).toContainText("Chỉnh sửa khoản thu");
    await expect(dialog(page).getByLabel("Số tiền")).toHaveValue("1.500.000");
    await dialog(page).getByLabel("Nội dung thu").fill(`${incomeDescription} sửa`);
    await dialog(page).getByRole("button", { name: "Lưu" }).click();
    await expect(dialog(page)).toBeHidden();
    await expect(tableRow(page, `${incomeDescription} sửa`)).toBeVisible();

    const incomeRows = await expectClientExport(page, INCOME_EXPORT);
    const exportedIncome = incomeRows.find((r) => r[2] === `${incomeDescription} sửa`);
    expect(exportedIncome).toBeDefined();
    expect(exportedIncome?.[0]).toMatch(DATE_CELL);
    expect(exportedIncome?.[1]).toBe("—");
    expect(exportedIncome?.[4]).toBe(incomeCategory);
    expect(exportedIncome?.[5]).toBe(1_500_000);
    expect(exportedIncome?.[6]).toBe("Tiền mặt");

    // An income voucher cannot be deleted on the reference: the row keeps only edit + print.
    const editedIncomeRow = tableRow(page, `${incomeDescription} sửa`);
    await expect(editedIncomeRow.getByRole("button", { name: "Xoá" })).toHaveCount(0);
    await expect(editedIncomeRow.getByRole("button", { name: "Duyệt chi" })).toHaveCount(0);
    await expectPrintPreview(page, `${incomeDescription} sửa`, "In khoản thu");
    expect(await readAmount(page, "Tổng doanh thu")).toBe(incomeBefore + 1_500_000);

    // --- Chi phí: a new expense waits as "Dự chi" and only counts once approved. ---
    await selectPill(page, "Chi phí");
    await expect(page.getByText("Tổng chi phí").first()).toBeVisible();
    const approvedBefore = await readAmount(page, "Đã duyệt chi");
    const pendingBefore = await readAmount(page, "Đang dự chi");

    await page.getByRole("button", { name: "Thêm mới" }).click();
    await expect(dialog(page)).toContainText("Thêm chi phí");
    await expect(dialog(page).getByText("Chọn khách hàng")).toHaveCount(0);
    await expect(dialog(page).getByText("Người nhận")).toBeVisible();
    await shot(page, "report-tab2-modal-expense");
    await dialog(page).getByLabel("Số tiền").fill("2500000");
    await pickSearchOption(page, dialog(page), "Mục chi", expenseCategory);
    await dialog(page).getByLabel("Nội dung chi").fill(expenseDescription);
    await dialog(page).getByRole("button", { name: "Lưu" }).click();
    await expect(dialog(page)).toBeHidden();

    const expenseRow = tableRow(page, expenseDescription);
    await expect(expenseRow).toBeVisible();
    await expect(expenseRow).toContainText("Dự chi");
    await expect.poll(() => readAmount(page, "Đang dự chi")).toBe(pendingBefore + 2_500_000);
    expect(await readAmount(page, "Đã duyệt chi")).toBe(approvedBefore);
    await shot(page, "report-tab2-expense", true);

    // A pending expense carries the reference's four round buttons; "Tổng chi phí" ignores it.
    for (const name of ["Duyệt chi", "Chỉnh sửa", "Xoá", "In chi phí"]) {
      await expect(expenseRow.getByRole("button", { name, exact: true })).toBeVisible();
    }
    expect(await readAmount(page, "Tổng chi phí")).toBe(approvedBefore);

    await expenseRow.getByRole("button", { name: "Duyệt chi" }).click();
    await expect(dialog(page)).toContainText("Xác nhận duyệt");
    await expect(dialog(page)).toContainText(`Bạn có chắc muốn duyệt phiếu chi ${expenseDescription} không?`);
    await expect(dialog(page)).toContainText("Hành động này không thể hoàn tác.");
    await shot(page, "report-tab2-approve-confirm");
    await dialog(page).getByRole("button", { name: "Duyệt" }).click();
    await expectToast(page, "Duyệt chi phí thành công");
    await expect(dialog(page)).toBeHidden();
    await expect(expenseRow).toContainText("Đã duyệt");
    // Approved: only the print button is left.
    await expect(expenseRow.getByRole("button", { name: "Duyệt chi" })).toHaveCount(0);
    await expect(expenseRow.getByRole("button", { name: "Chỉnh sửa" })).toHaveCount(0);
    await expect(expenseRow.getByRole("button", { name: "Xoá" })).toHaveCount(0);
    await expect.poll(() => readAmount(page, "Đã duyệt chi")).toBe(approvedBefore + 2_500_000);
    await expect.poll(() => readAmount(page, "Tổng chi phí")).toBe(approvedBefore + 2_500_000);
    await expect.poll(() => readAmount(page, "Đang dự chi")).toBe(pendingBefore);
    await expectPrintPreview(page, expenseDescription, "In chi phí");

    // A second expense stays pending, gets edited, and is then deleted (there is no reject).
    await page.getByRole("button", { name: "Thêm mới" }).click();
    await dialog(page).getByLabel("Số tiền").fill("700000");
    await pickSearchOption(page, dialog(page), "Mục chi", expenseCategory);
    await dialog(page).getByLabel("Nội dung chi").fill(pendingDescription);
    await dialog(page).getByRole("button", { name: "Lưu" }).click();
    await expectToast(page, "Tạo phiếu thu chi thành công");
    await expect(dialog(page)).toBeHidden();
    const pendingRow = tableRow(page, pendingDescription);
    await expect(pendingRow).toContainText("Dự chi");

    await pendingRow.getByRole("button", { name: "Chỉnh sửa" }).click();
    await expect(dialog(page)).toContainText("Chỉnh sửa chi phí");
    await dialog(page).getByLabel("Số tiền").fill("800000");
    await dialog(page).getByRole("button", { name: "Lưu" }).click();
    await expectToast(page, "Cập nhật phiếu thu chi thành công");
    await expect(pendingRow).toContainText("800.000");
    await expect.poll(() => readAmount(page, "Đang dự chi")).toBe(pendingBefore + 800_000);

    // The status filter counts follow the rows.
    await page.locator(".ant-segmented-item-label", { hasText: "Đã duyệt (" }).click();
    await expect(tableRow(page, expenseDescription)).toBeVisible();
    await expect(tableRow(page, pendingDescription)).toHaveCount(0);
    await page.locator(".ant-segmented-item-label", { hasText: "Tất cả (" }).click();

    const expenseRows = await expectClientExport(page, EXPENSE_EXPORT);
    const exportedExpense = expenseRows.find((r) => r[2] === expenseDescription);
    expect(exportedExpense).toBeDefined();
    expect(exportedExpense?.[0]).toMatch(DATE_CELL);
    expect(exportedExpense?.[1]).toMatch(DATE_CELL);
    expect(exportedExpense?.[5]).toBe(expenseCategory);
    expect(exportedExpense?.[6]).toBe(2_500_000);
    expect(exportedExpense?.[8]).toBe("Đã duyệt");
    expect(expenseRows.find((r) => r[2] === pendingDescription)?.[8]).toBe("Dự chi");

    // Tidy the pending voucher; the approved one stays as the branch's history.
    await deleteVoucher(page, pendingDescription);
    await expect.poll(() => readAmount(page, "Đang dự chi")).toBe(pendingBefore);
    await expect(tableRow(page, expenseDescription)).toBeVisible();

    // Like the reference, a category still in use can be deleted: it leaves the
    // pick list, but the vouchers filed under it keep showing its name.
    await selectPill(page, "Danh mục");
    await page.getByRole("button", { name: "Danh mục chi phí" }).click();
    await deleteCategory(page, expenseCategory);
    await page.getByRole("button", { name: "Danh mục thu nhập" }).click();
    await deleteCategory(page, incomeCategory);
    await selectPill(page, "Chi phí");
    await expect(tableRow(page, expenseDescription)).toContainText(expenseCategory);
    await selectPill(page, "Thu nhập");
    await expect(tableRow(page, `${incomeDescription} sửa`)).toContainText(incomeCategory);
  });

  test("tab Kết quả kinh doanh: sáu dòng tổng hợp từ API, không có bộ lọc bác sĩ", async ({ page }) => {
    await openReport(page, "?reportTab=result", "/api/v1/app/clinic-reports/business-result");

    for (const label of ["Doanh thu tổng", "Thu từ dịch vụ điều trị", "Thu khác", "Hoàn tiền từ dịch vụ điều trị", "Chi phí", "Kết quả kinh doanh"]) {
      await expect(page.getByText(label, { exact: true }).first()).toBeVisible();
    }
    await expect(page.getByText("Bác sĩ điều trị")).toHaveCount(0);
    await shot(page, "report-tab3-result", true);
  });

  test("tab Luân chuyển dòng tiền V2: danh mục sổ quỹ, nạp / rút / luân chuyển, số dư, xuất Excel, hủy — dữ liệu thật", async ({ page }) => {
    const id = runId();
    const category = `Sổ quỹ E2E ${id}`;
    const depositNote = `Nạp E2E ${id}`;
    const withdrawNote = `Rút E2E ${id}`;
    const transferNote = `Luân chuyển E2E ${id}`;

    await openReport(page, "?reportTab=cashflow-v2&report_dateMode=day", "/api/v1/app/cash-management/cashflow-entries");
    await expect(page.getByText("Tổng Tiền Mặt")).toBeVisible();
    await expect(page.getByText("Doanh thu dịch vụ")).toBeVisible();

    // --- Danh mục sổ quỹ: the deposit below is filed under it. ---
    await selectPill(page, "Danh mục");
    await expect(page.getByText("Danh mục sổ quỹ")).toBeVisible();
    await page.getByRole("button", { name: "Thêm mục" }).click();
    await expect(dialog(page)).toContainText("Thêm danh mục sổ quỹ mới");
    await expect(dialog(page).getByRole("button", { name: "Lưu" })).toBeDisabled();
    await dialog(page).getByLabel("Tên danh mục sổ quỹ").fill(category);
    await dialog(page).getByRole("button", { name: "Lưu" }).click();
    await expectToast(page, "Tạo danh mục thành công");
    await expect(tableRow(page, category)).toBeVisible();
    await shot(page, "report-tab4-category", true);

    // --- Tổng quan ---
    await selectPill(page, "Tổng quan");
    await expect(page.getByText("Tổng Tiền Mặt")).toBeVisible();
    const totalBefore = await readAmount(page, "Tổng Tiền");
    const cashBefore = await readAmount(page, "Tổng Tiền Mặt");
    const bankBefore = await readAmount(page, "Tổng Chuyển Khoản");
    await shot(page, "report-tab4-overview", true);

    // Nạp: money in, positive in the ledger.
    // AntD prefixes the icon's name, so the accessible name is "vertical-align-bottom Nạp".
    await page.getByRole("button", { name: /Nạp$/ }).click();
    await expect(dialog(page)).toContainText("Tạo giao dịch nạp");
    await expect(dialog(page).getByText("Số dư khả dụng")).toHaveCount(0);
    // Only Nạp offers the card-reconciliation holding, and only that holding shows the balance line.
    await expectSelectOptions(page, dialog(page), "Hình thức", ["Tiền mặt", "Chuyển khoản", "Cà thẻ (đối soát)"]);
    await pickSelectOption(page, dialog(page), "Hình thức", "Cà thẻ (đối soát)");
    await expect(dialog(page)).toContainText("Số dư khả dụng (Cà thẻ chờ đối soát)");
    await pickSelectOption(page, dialog(page), "Hình thức", "Chuyển khoản");
    await expect(dialog(page).getByText("Số dư khả dụng")).toHaveCount(0);
    await pickSelectOption(page, dialog(page), "Hình thức", "Tiền mặt");
    await shot(page, "report-tab4-modal-deposit");
    await dialog(page).getByRole("button", { name: "Lưu" }).click();
    await expect(dialog(page).getByText("Số tiền phải lớn hơn 0")).toBeVisible();
    await dialog(page).getByLabel("Số tiền (VNĐ)").fill("1500000");
    await pickSearchOption(page, dialog(page), "Danh mục", category);
    await dialog(page).getByLabel("Ghi chú").fill(depositNote);
    await dialog(page).getByRole("button", { name: "Lưu" }).click();
    await expectToast(page, "Tạo giao dịch thành công");
    await expect(dialog(page)).toBeHidden();

    const depositRow = tableRow(page, depositNote);
    await expect(depositRow).toBeVisible();
    await expect(depositRow).toContainText("Nạp");
    await expect(depositRow).toContainText("+1.500.000");
    await expect(depositRow).toContainText(category);
    await expect(depositRow).toContainText("Tiền mặt");
    await expect.poll(() => readAmount(page, "Tổng Tiền Mặt")).toBe(cashBefore + 1_500_000);
    await expect.poll(() => readAmount(page, "Tổng Tiền")).toBe(totalBefore + 1_500_000);

    await expectVoucherPreview(page, depositNote, "PHIẾU THU");

    // Edit keeps the amount and rewrites the note; a reload still shows it.
    await depositRow.getByRole("button", { name: "Chỉnh sửa" }).click();
    await expect(dialog(page)).toContainText("Cập nhật giao dịch nạp");
    await expect(dialog(page).getByLabel("Số tiền (VNĐ)")).toHaveValue("1.500.000");
    await shot(page, "report-tab4-edit-modal");
    await dialog(page).getByLabel("Ghi chú").fill(`${depositNote} sửa`);
    await dialog(page).getByRole("button", { name: "Lưu" }).click();
    await expectToast(page, "Cập nhật giao dịch thành công");
    await page.reload();
    await expect(tableRow(page, `${depositNote} sửa`)).toBeVisible();
    expect(await readAmount(page, "Tổng Tiền Mặt")).toBe(cashBefore + 1_500_000);

    // Rút: refused beyond the available balance, then recorded as a negative line.
    await page.getByRole("button", { name: /Rút$/ }).click();
    await expect(dialog(page)).toContainText("Tạo giao dịch rút");
    await expect(dialog(page)).toContainText("Số dư khả dụng (Tiền mặt)");
    await expectSelectOptions(page, dialog(page), "Hình thức", ["Tiền mặt", "Chuyển khoản"]);
    await pickSelectOption(page, dialog(page), "Hình thức", "Chuyển khoản");
    await expect(dialog(page)).toContainText("Số dư khả dụng (Chuyển khoản)");
    await pickSelectOption(page, dialog(page), "Hình thức", "Tiền mặt");
    await expect(dialog(page)).toContainText("Số dư khả dụng (Tiền mặt)");
    await shot(page, "report-tab4-modal-withdraw");
    await dialog(page).getByLabel("Số tiền (VNĐ)").fill(String(cashBefore + 1_500_000 + 1));
    await dialog(page).getByRole("button", { name: "Lưu" }).click();
    await expect(dialog(page).getByText("Số dư không đủ để thực hiện giao dịch")).toBeVisible();
    await dialog(page).getByLabel("Số tiền (VNĐ)").fill("500000");
    await dialog(page).getByLabel("Ghi chú").fill(withdrawNote);
    await dialog(page).getByRole("button", { name: "Lưu" }).click();
    await expectToast(page, "Tạo giao dịch thành công");
    const withdrawRow = tableRow(page, withdrawNote);
    await expect(withdrawRow).toContainText("Rút");
    await expect(withdrawRow).toContainText("-500.000");
    await expect.poll(() => readAmount(page, "Tổng Tiền Mặt")).toBe(cashBefore + 1_000_000);

    // Luân chuyển: cash to bank, the total unchanged.
    await page.getByRole("button", { name: /Luân chuyển$/ }).click();
    await expect(dialog(page)).toContainText("Tạo giao dịch luân chuyển");
    await expect(dialog(page).getByText("Luân chuyển đến")).toBeVisible();
    await expect(dialog(page).locator(".floating-field").filter({ hasText: "Danh mục" })).toHaveCount(0);
    // Both selects list both holdings like the reference; picking one side onto the other
    // flips the other side (never an error), and the balance line follows the source.
    await expect(dialog(page)).toContainText("Số dư khả dụng (Tiền mặt)");
    await expectSelectOptions(page, dialog(page), "Luân chuyển đến", ["Tiền mặt", "Chuyển khoản"]);
    await pickSelectOption(page, dialog(page), "Luân chuyển đến", "Tiền mặt");
    await expect(antSelectIn(dialog(page), "Hình thức")).toContainText("Chuyển khoản");
    await expect(dialog(page)).toContainText("Số dư khả dụng (Chuyển khoản)");
    await expect(dialog(page).getByText("Nơi nhận phải khác hình thức chuyển")).toHaveCount(0);
    await pickSelectOption(page, dialog(page), "Hình thức", "Tiền mặt");
    await expect(antSelectIn(dialog(page), "Luân chuyển đến")).toContainText("Chuyển khoản");
    await expect(dialog(page)).toContainText("Số dư khả dụng (Tiền mặt)");
    await expect(dialog(page).getByText("Nơi nhận phải khác hình thức chuyển")).toHaveCount(0);
    await shot(page, "report-tab4-modal-transfer");
    await dialog(page).getByLabel("Số tiền (VNĐ)").fill("200000");
    await dialog(page).getByLabel("Ghi chú").fill(transferNote);
    await dialog(page).getByRole("button", { name: "Lưu" }).click();
    await expectToast(page, "Tạo giao dịch thành công");
    const transferRow = tableRow(page, transferNote);
    await expect(transferRow).toContainText("Luân chuyển");
    await expect(transferRow).toContainText("Tiền mặt → Chuyển khoản");
    await expect.poll(() => readAmount(page, "Tổng Tiền Mặt")).toBe(cashBefore + 800_000);
    await expect.poll(() => readAmount(page, "Tổng Chuyển Khoản")).toBe(bankBefore + 200_000);
    expect(await readAmount(page, "Tổng Tiền")).toBe(totalBefore + 1_000_000);
    await shot(page, "report-tab4-after", true);

    // The workbook mirrors the page: a withdrawal is negative, the creator named.
    const ledgerRows = await expectClientExport(page, LEDGER_EXPORT);
    const exportedWithdraw = ledgerRows.find((r) => r[6] === withdrawNote);
    expect(exportedWithdraw).toBeDefined();
    expect(exportedWithdraw?.[0]).toMatch(DATE_CELL);
    expect(exportedWithdraw?.[1]).toBe("Rút");
    expect(exportedWithdraw?.[4]).toBe(-500_000);
    expect(exportedWithdraw?.[5]).not.toBe("Không xác định");
    const exportedDeposit = ledgerRows.find((r) => r[6] === `${depositNote} sửa`);
    expect(exportedDeposit?.[3]).toBe(category);
    expect(exportedDeposit?.[4]).toBe(1_500_000);

    // Hủy all three; the balances return to where they started.
    await deleteLedgerEntry(page, transferNote);
    await deleteLedgerEntry(page, withdrawNote);
    await deleteLedgerEntry(page, `${depositNote} sửa`);
    await expect.poll(() => readAmount(page, "Tổng Tiền Mặt")).toBe(cashBefore);
    await expect.poll(() => readAmount(page, "Tổng Chuyển Khoản")).toBe(bankBefore);
    expect(await readAmount(page, "Tổng Tiền")).toBe(totalBefore);

    // The category is free again once nothing is filed under it.
    await selectPill(page, "Danh mục");
    await expect(tableRow(page, category)).toBeVisible();
    await deleteCategory(page, category, "Đã xoá danh mục", "Xác nhận xoá danh mục");
  });

  test("responsive: không tràn ngang ở 390px và dialog vẫn dùng được", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openReport(page, "", "/api/v1/app/clinic-reports/");

    const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(await overflow()).toBeLessThanOrEqual(0);
    await shot(page, "report-mobile-tab1", true);

    await selectPill(page, "Quản lý thu chi");
    await expect(page.getByText("Tổng doanh thu").first()).toBeVisible();
    expect(await overflow()).toBeLessThanOrEqual(0);
    await page.getByRole("button", { name: "Thêm mới" }).click();
    await expect(dialog(page)).toContainText("Thêm khoản thu");
    await shot(page, "report-mobile-modal");
    await closeDialog(page);

    await selectPill(page, "Luân chuyển dòng tiền V2");
    await expect(page.getByText("Tổng Tiền Mặt")).toBeVisible();
    expect(await overflow()).toBeLessThanOrEqual(0);
    await shot(page, "report-mobile-tab4", true);
  });
});
