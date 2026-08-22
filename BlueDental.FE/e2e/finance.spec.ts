import { expect, test } from "@playwright/test";
import { assertRealApiTraffic, login, runId } from "./fixtures/auth";

/** "Tổng chi10.000.000 đ" -> 10000000 */
async function readAmount(page: import("@playwright/test").Page, label: string): Promise<number> {
  const text = await page.getByText(label, { exact: true }).locator("..").innerText();
  const digits = text.replace(label, "").replace(/[^\d]/g, "");
  return digits ? Number(digits) : 0;
}

/**
 * Feature: Quản lý thu chi + Luân chuyển dòng tiền.
 *
 * The rule under test is the reference's: an expense is only counted once it has
 * been approved. That is server-side behaviour, so the test drives the real API.
 */
test.describe("Thu chi", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("an expense only counts towards Tổng chi after approval", async ({ page }) => {
    const id = runId();
    const categoryName = `Mục E2E ${id}`;
    const description = `Chi phí E2E ${id}`;

    await page.goto("/report?tab=cashflow&dateMode=month");
    await assertRealApiTraffic(page, "/api/v1/app/sales");

    // The branch accumulates vouchers across runs, so assert the delta this
    // voucher causes rather than an absolute total.
    const expenseBefore = await readAmount(page, "Tổng chi");

    await page.getByRole("button", { name: /Thêm mới/ }).click();
    const dialog = page.getByRole("dialog");

    await dialog.getByLabel("Loại phiếu").click();
    await page.getByTitle("Phiếu chi (cần duyệt)").click();

    // Categories are per-type; create one inline so the test owns its data.
    await dialog.getByLabel("Mục thu chi").click();
    await page.getByPlaceholder("Thêm mục mới").fill(categoryName);
    await page.getByPlaceholder("Thêm mục mới").press("Enter");

    await dialog.getByLabel("Số tiền (đ)").fill("2500000");
    await dialog.getByLabel("Nội dung").fill(description);
    await dialog.getByRole("button", { name: "Tạo" }).click();

    const row = page.getByRole("row", { name: new RegExp(description) });
    await expect(row).toBeVisible();
    await expect(row).toContainText("Chờ duyệt");

    // Pending expenses are deliberately excluded from the total.
    await expect(page.getByText(/phiếu chi đang chờ duyệt/)).toBeVisible();
    expect(await readAmount(page, "Tổng chi")).toBe(expenseBefore);

    await row.getByRole("button", { name: "Duyệt" }).click();
    await expect(row).toContainText("Đã duyệt");

    // Once approved it counts, and the voucher can no longer be edited.
    await expect(row.getByRole("button", { name: "Sửa" })).toHaveCount(0);
    await expect
      .poll(() => readAmount(page, "Tổng chi"))
      .toBe(expenseBefore + 2_500_000);
  });

  test("a deposit moves the cash balance", async ({ page }) => {
    await page.goto("/report?tab=cashflow-v2&dateMode=month");
    await assertRealApiTraffic(page, "/api/v1/app/cash-management/cashflow-entries");

    const cashBefore = await readAmount(page, "Tổng Tiền Mặt");

    await page.getByRole("button", { name: "Nạp", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Số tiền (đ)").fill("1000000");
    await dialog.getByRole("button", { name: "Ghi nhận" }).click();

    await expect(page.getByRole("row", { name: /Nạp/ }).first()).toBeVisible();
    await expect
      .poll(() => readAmount(page, "Tổng Tiền Mặt"))
      .toBe(cashBefore + 1_000_000);
  });
});
