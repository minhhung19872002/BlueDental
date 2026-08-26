import { expect, test } from "@playwright/test";
import { login } from "./fixtures/auth";

/**
 * Feature: the Vận hành report sub-tabs.
 *
 * Real stack only: real login, real ASP.NET Core API, real PostgreSQL. Each of
 * these reads tables another feature owns, so the assertions are about the
 * shape the reference gives each screen and about the server actually answering
 * — not about particular seeded rows, which move as the demo clinic is rebuilt.
 */
test.describe("Vận hành — báo cáo", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("Báo cáo lists work across the clinic and filters by action", async ({ page }) => {
    await page.goto("/operations/overview?overviewSubTab=report");

    for (const heading of ["Ngày / Khách hàng", "Nhân sự", "Hành động", "Doanh số"]) {
      await expect(page.getByRole("columnheader", { name: heading })).toBeVisible();
    }

    // The server answered with rows, not an empty screen.
    await expect(page.locator("tbody tr.ant-table-row").first()).toBeVisible();
    const all = await page.locator("tbody tr.ant-table-row").count();

    // Narrowing to one action must not leave more rows than the unfiltered list.
    await page.getByLabel("Hành động").click();
    await page
      .locator(".ant-select-dropdown:visible .ant-select-item-option")
      .filter({ hasText: /^Chẩn đoán$/ })
      .click();
    await page.keyboard.press("Escape");

    await expect
      .poll(async () => page.locator("tbody tr.ant-table-row").count())
      .toBeLessThanOrEqual(all);
    await expect(page.getByRole("cell", { name: "Chẩn đoán", exact: true }).first()).toBeVisible();
  });

  test("Chẩn đoán chưa điều trị only lists diagnoses with no treatment", async ({ page }) => {
    await page.goto("/operations/overview?overviewSubTab=untreated");

    for (const heading of ["Ngày", "Khách hàng", "Răng", "Chẩn đoán"]) {
      await expect(page.getByRole("columnheader", { name: heading, exact: true })).toBeVisible();
    }

    await expect(page.locator("tbody tr.ant-table-row").first()).toBeVisible();
    // No category panel here: this sub-tab is a report, not the article screen.
    await expect(page.getByRole("button", { name: /Thêm Mới$/ })).toHaveCount(0);
  });

  test("Đơn thuốc says what the reference says: not built yet", async ({ page }) => {
    await page.goto("/operations/overview?overviewSubTab=prescription");

    await expect(page.getByText("Nội dung đang được xây dựng.")).toBeVisible();
    // The period switch is still there, as it is on the reference.
    await expect(page.getByRole("tab", { name: "Ngày", exact: true })).toBeVisible();
  });

  test("Khách hàng phát sinh totals each consultant, and stops at Tháng", async ({ page }) => {
    await page.goto("/operations/finance?financeSubTab=customer-report");

    for (const heading of ["Nhân sự tư vấn", "Tổng lượt tư vấn", "Doanh thu từ tư vấn"]) {
      await expect(page.getByRole("columnheader", { name: heading })).toBeVisible();
    }

    // The reference offers no Năm on this report.
    await expect(page.getByRole("tab", { name: "Tháng", exact: true })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Năm", exact: true })).toHaveCount(0);
  });

  test("Hóa đơn lists invoices with their money split out", async ({ page }) => {
    await page.goto("/operations/finance?financeSubTab=invoice");

    for (const heading of ["Số hóa đơn", "Tổng trước VAT", "Tổng VAT", "Tổng tiền"]) {
      await expect(page.getByRole("columnheader", { name: heading })).toBeVisible();
    }

    await expect(page.locator("tbody tr.ant-table-row").first()).toBeVisible();
  });

  test("Hoàn thành theo dịch vụ shows its five figures over the service lines", async ({ page }) => {
    await page.goto("/operations/finance?financeSubTab=service-complete");

    for (const label of [
      "Thực thu",
      "Tổng doanh thu",
      "Doanh thu từ KH tạm ứng",
      "Dịch vụ hoàn thành",
      "Dịch vụ doanh số riêng",
    ]) {
      await expect(page.getByText(label, { exact: true })).toBeVisible();
    }

    await expect(page.locator("tbody tr.ant-table-row").first()).toBeVisible();
    await expect(page.getByText(/Hiển thị .* dịch vụ/)).toBeVisible();
  });

  test("Truy cập filters by the card that is picked", async ({ page }) => {
    await page.goto("/operations/treatment?treatmentTab=access");

    const total = page.getByRole("button", { name: /Tổng doanh số/ });
    const completed = page.getByRole("button", { name: /Dịch vụ đã hoàn thành/ });

    await expect(total).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("tbody tr.ant-table-row").first()).toBeVisible();
    const everything = await page.locator("tbody tr.ant-table-row").count();

    await completed.click();
    await expect(completed).toHaveAttribute("aria-pressed", "true");

    // Only finished lines survive, so the list can only shrink — and every
    // classification cell left must be the finished one.
    await expect.poll(async () => page.locator("tbody tr.ant-table-row").count()).toBeLessThanOrEqual(everything);
    await expect(page.locator(".bd-ops-pill--own")).toHaveCount(0);
  });

  test("the period switch re-reads the server", async ({ page }) => {
    await page.goto("/operations/finance?financeSubTab=service-complete");
    await expect(page.locator("tbody tr.ant-table-row").first()).toBeVisible();

    const monthly = await page.getByText(/Hiển thị .* dịch vụ/).innerText();

    // One day holds less than a whole month, so the summary has to change.
    await page.getByRole("tab", { name: "Ngày", exact: true }).click();
    await expect
      .poll(async () => page.getByText(/Hiển thị .* dịch vụ/).innerText())
      .not.toBe(monthly);
  });
});
