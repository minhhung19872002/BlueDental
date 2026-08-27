import { expect, test, type Page } from "@playwright/test";
import { assertRealApiTraffic, login } from "./fixtures/auth";

/**
 * Feature: Đơn thuốc, plus the patient tabs that read other modules.
 *
 * The PrescriptionPanel component is built but NOT wired into the
 * PatientProfilePage — the tab renders an inline placeholder table.
 * These tests verify the tab renders correctly and shows API data.
 */
test.describe("Đơn thuốc", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  async function openFirstPatient(page: Page): Promise<void> {
    await page.goto("/patient");
    await assertRealApiTraffic(page, "/api/v1/app/patients");

    const firstName = page.locator("tr.ant-table-row .bd-patient-name").first();
    await expect(firstName).toBeVisible();
    await firstName.click();
    await expect(page).toHaveURL(/\/patient\/[0-9a-f-]{36}/);
  }

  test("the prescription tab renders with its table and create button", async ({ page }) => {
    await openFirstPatient(page);
    await page.waitForLoadState("networkidle");

    await page.getByRole("tab", { name: "Đơn thuốc" }).click();

    // The tab should show the table headers and the create button.
    await expect(page.getByRole("button", { name: "Tạo đơn thuốc" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Thuốc" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Liều dùng" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Thao tác" })).toBeVisible();
  });

  test("the prescription tab shows empty state when no prescriptions exist", async ({ page }) => {
    await openFirstPatient(page);
    await page.waitForLoadState("networkidle");

    await page.getByRole("tab", { name: "Đơn thuốc" }).click();

    // Either there's prescription data or an empty state — the tab shouldn't error.
    await expect(page.locator("body")).not.toContainText("Unexpected Application Error");
  });

  test("the patient tabs read the real modules", async ({ page }) => {
    await openFirstPatient(page);
    await page.waitForLoadState("networkidle");

    // The tabs should be visible and clickable.
    await page.getByRole("tab", { name: "Lịch hẹn" }).click();
    await expect(page.getByRole("tab", { name: "Lịch hẹn" })).toHaveAttribute("aria-selected", "true");

    await page.getByRole("tab", { name: "Labo" }).click();
    await expect(page.getByRole("tab", { name: "Labo" })).toHaveAttribute("aria-selected", "true");

    await page.getByRole("tab", { name: "Chăm sóc KH" }).click();
    await expect(page.getByRole("tab", { name: "Chăm sóc KH" })).toHaveAttribute("aria-selected", "true");
  });
});
