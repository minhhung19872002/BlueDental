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

    const firstName = page.locator("tr.ant-table-row .bd-patient-name").first();
    await expect(firstName).toBeVisible();
    await firstName.click();
    await expect(page).toHaveURL(/\/patient\/[0-9a-f-]{36}/);
  }

  test("the diagnosis tab renders the dental chart and diagnosis table", async ({ page }) => {
    await openFirstPatient(page);
    await page.waitForLoadState("networkidle");

    await page.getByRole("link", { name: "Chẩn đoán & Tư vấn" }).click();

    // The two cards the reference puts on this tab.
    await expect(page.getByRole("heading", { name: "Tạo chẩn đoán" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Phiếu tư vấn", exact: true })).toBeVisible();

    // The chart lives inside the diagnosis editor, which opens on +.
    await page.locator(".pd-diagnosis-card .pd-card-title").getByRole("button").click();
    await expect(page.getByRole("button", { name: "Chọn Răng" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Hàm Trên" })).toBeVisible();
  });

  test("the dental chart on the diagnosis tab responds to tooth clicks", async ({ page }) => {
    await openFirstPatient(page);
    await page.waitForLoadState("networkidle");

    await page.getByRole("link", { name: "Chẩn đoán & Tư vấn" }).click();
    await page.locator(".pd-diagnosis-card .pd-card-title").getByRole("button").click();

    // Click a tooth and verify the selection text updates.
    const tooth11 = page.getByRole("button", { name: /Răng 11/ });
    await tooth11.click();
    await expect(page.getByText(/Răng đã chọn:.*11/)).toBeVisible();

    // Click again to deselect.
    await tooth11.click();
    await expect(page.getByText("Răng đã chọn: —")).toBeVisible();

    // "Hàm Trên" fills the whole upper jaw in one go.
    await page.getByRole("button", { name: "Hàm Trên" }).click();
    await expect(page.getByText(/Răng đã chọn:.*18.*28/)).toBeVisible();
  });
});
