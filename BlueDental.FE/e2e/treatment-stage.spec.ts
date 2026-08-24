import { expect, test, type Page } from "@playwright/test";
import { assertRealApiTraffic, login } from "./fixtures/auth";

/**
 * Feature: Công đoạn điều trị.
 *
 * The diagnosis, advise, and treatment plan workflow buttons on the patient
 * profile page are placeholder-only (no onClick handlers). These tests verify
 * the tabs render correctly and the dental chart is interactive.
 */
test.describe("Công đoạn điều trị", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  async function openFirstPatient(page: Page): Promise<void> {
    await page.goto("/patient");
    await assertRealApiTraffic(page, "/api/v1/app/patients");

    const firstRow = page.locator("tr.ant-table-row").first();
    await expect(firstRow).toBeVisible();
    await firstRow.click();
    await expect(page).toHaveURL(/\/patient\/[0-9a-f-]{36}/);
  }

  test("the diagnosis tab renders the dental chart and diagnosis table", async ({ page }) => {
    await openFirstPatient(page);
    await page.waitForLoadState("networkidle");

    await page.getByRole("tab", { name: "Chẩn đoán & Tư vấn" }).click();

    // Dental chart should be visible.
    await expect(page.getByText("Biểu đồ răng")).toBeVisible();

    // The chart tabs should be present.
    await expect(page.getByRole("tab", { name: "Chọn Răng" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Hàm Trên" })).toBeVisible();

    // Diagnosis records table headers.
    await expect(page.getByText("Phiếu chẩn đoán", { exact: true })).toBeVisible();

    // Advise records table.
    await expect(page.getByText("Phiếu tư vấn", { exact: true })).toBeVisible();
  });

  test("the dental chart on the diagnosis tab responds to tooth clicks", async ({ page }) => {
    await openFirstPatient(page);
    await page.waitForLoadState("networkidle");

    await page.getByRole("tab", { name: "Chẩn đoán & Tư vấn" }).click();

    // Click a tooth and verify the selection text updates.
    const tooth11 = page.getByRole("button", { name: /Răng 11/ });
    await tooth11.click();
    await expect(page.getByText(/Đã chọn:.*11/)).toBeVisible();

    // Click again to deselect.
    await tooth11.click();
    await expect(page.getByText("Chưa chọn răng")).toBeVisible();
  });
});
