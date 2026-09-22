import { expect, test, type Page } from "@playwright/test";
import { assertRealApiTraffic, login, runId } from "./fixtures/auth";

/** "1.500.000 đ\nTổng chi phí" under the icon card -> 1500000. */
async function readAmount(page: Page, label: string): Promise<number> {
  const text = await page.getByText(label, { exact: true }).first().locator("..").innerText();
  const digits = text.replace(label, "").replace(/[^\d]/g, "");
  return digits ? Number(digits) : 0;
}

function dialog(page: Page) {
  return page.locator(".ant-modal").filter({ visible: true }).first();
}

function tableRow(page: Page, text: string) {
  return page.locator(".ant-table-row").filter({ hasText: text });
}

/** SearchSelect has no id: scope by the floating-field wrapper that carries the label. */
async function pickSearchOption(page: Page, label: string, optionText: string): Promise<void> {
  await dialog(page).locator(".floating-field").filter({ hasText: label }).getByRole("combobox").click();
  const dropdown = page.locator("#ss-portal-dropdown");
  await dropdown.getByPlaceholder("Tìm kiếm...").fill(optionText);
  await dropdown.getByRole("option", { name: optionText, exact: true }).click();
}

/**
 * Feature: Quản lý thu chi + Luân chuyển dòng tiền — the two server-side rules.
 *
 * An expense is only counted as spent once it has been approved, and a cash
 * movement changes the running balance. Both are decided by the API, so the
 * tests drive the real one. The fuller walk-through lives in report.spec.ts.
 */
test.describe("Thu chi", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("an expense only counts towards Đã duyệt chi after approval", async ({ page }) => {
    const id = runId();
    const categoryName = `Mục E2E ${id}`;
    const description = `Chi phí E2E ${id}`;

    const traffic = assertRealApiTraffic(page, "/api/v1/app/sales");
    await page.goto("/report?reportTab=cashflow&report_dateMode=day");
    await traffic;

    // Categories are per-type: create one so the test owns its data.
    await page.getByRole("tab", { name: "Danh mục", exact: true }).first().click();
    await page.getByRole("button", { name: "Danh mục chi phí" }).click();
    await page.getByRole("button", { name: "Thêm mục" }).click();
    await dialog(page).getByLabel("Tên phân loại").fill(categoryName);
    await dialog(page).getByRole("button", { name: "Lưu" }).click();
    await expect(page.getByText("Tạo nhóm thành công").first()).toBeVisible();

    await page.getByRole("tab", { name: "Chi phí", exact: true }).first().click();
    await expect(page.getByText("Tổng chi phí").first()).toBeVisible();

    // The branch accumulates vouchers across runs, so assert the delta this
    // voucher causes rather than an absolute total.
    const approvedBefore = await readAmount(page, "Đã duyệt chi");

    await page.getByRole("button", { name: "Thêm mới" }).click();
    await expect(dialog(page)).toContainText("Thêm chi phí");
    await dialog(page).getByLabel("Số tiền").fill("2500000");
    await pickSearchOption(page, "Mục chi", categoryName);
    await dialog(page).getByLabel("Nội dung chi").fill(description);
    await dialog(page).getByRole("button", { name: "Lưu" }).click();
    await expect(dialog(page)).toBeHidden();

    const row = tableRow(page, description);
    await expect(row).toBeVisible();
    await expect(row).toContainText("Dự chi");

    // Pending expenses are deliberately excluded from the approved total.
    await expect.poll(() => readAmount(page, "Đang dự chi")).toBeGreaterThanOrEqual(2_500_000);
    expect(await readAmount(page, "Đã duyệt chi")).toBe(approvedBefore);

    // Approval goes through the reference's confirm dialog; the API takes no body.
    await row.getByRole("button", { name: "Duyệt chi" }).click();
    await expect(dialog(page)).toContainText("Xác nhận duyệt");
    await dialog(page).getByRole("button", { name: "Duyệt" }).click();
    await expect(page.getByText("Duyệt chi phí thành công").first()).toBeVisible();
    await expect(dialog(page)).toBeHidden();
    await expect(row).toContainText("Đã duyệt");

    // Once approved it counts, and only the print button is left on the row.
    await expect(row.getByRole("button", { name: "Duyệt chi" })).toHaveCount(0);
    await expect(row.getByRole("button", { name: "Xoá" })).toHaveCount(0);
    await expect.poll(() => readAmount(page, "Đã duyệt chi")).toBe(approvedBefore + 2_500_000);

    // Tidy the category (the reference allows deleting one that is in use);
    // the approved voucher stays as history and keeps the category's name.
    await page.getByRole("tab", { name: "Danh mục", exact: true }).first().click();
    await page.getByRole("button", { name: "Danh mục chi phí" }).click();
    await tableRow(page, categoryName).getByRole("button", { name: "delete" }).click();
    await expect(dialog(page).locator(".bd-modal-title")).toHaveText("Xác nhận xoá");
    await dialog(page).getByRole("button", { name: "Xoá" }).click();
    await expect(page.getByText("Đã xoá nhóm").first()).toBeVisible();
    await expect(tableRow(page, categoryName)).toHaveCount(0);
    await page.getByRole("tab", { name: "Chi phí", exact: true }).first().click();
    await expect(tableRow(page, description)).toContainText(categoryName);
  });

  test("a deposit moves the cash balance and a hủy moves it back", async ({ page }) => {
    const note = `Nạp E2E ${runId()}`;

    const traffic = assertRealApiTraffic(page, "/api/v1/app/cash-management/cashflow-entries");
    await page.goto("/report?reportTab=cashflow-v2&report_dateMode=day");
    await traffic;

    const cashBefore = await readAmount(page, "Tổng Tiền Mặt");

    // AntD prefixes the icon's name, so the accessible name is "vertical-align-bottom Nạp".
    await page.getByRole("button", { name: /Nạp$/ }).click();
    await expect(dialog(page)).toContainText("Tạo giao dịch nạp");
    await dialog(page).getByLabel("Số tiền (VNĐ)").fill("1000000");
    await dialog(page).getByLabel("Ghi chú").fill(note);
    await dialog(page).getByRole("button", { name: "Lưu" }).click();
    await expect(page.getByText("Tạo giao dịch thành công").first()).toBeVisible();

    const row = tableRow(page, note);
    await expect(row).toContainText("+1.000.000");
    await expect.poll(() => readAmount(page, "Tổng Tiền Mặt")).toBe(cashBefore + 1_000_000);

    await row.getByRole("button", { name: "Hủy", exact: true }).click();
    await expect(dialog(page)).toContainText("Xác nhận hủy giao dịch");
    await dialog(page).getByRole("button", { name: "Hủy giao dịch" }).click();
    await expect(page.getByText("Đã hủy giao dịch").first()).toBeVisible();
    await expect.poll(() => readAmount(page, "Tổng Tiền Mặt")).toBe(cashBefore);
  });
});
