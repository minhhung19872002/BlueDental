import { expect, test, type Page } from "@playwright/test";
import { assertRealApiTraffic, login } from "./fixtures/auth";

/**
 * Feature: Hình ảnh bệnh nhân.
 *
 * The image tab currently renders a placeholder with filter controls.
 * These tests verify the tab is accessible and renders correctly.
 */
test.describe("Hình ảnh bệnh nhân", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  async function openImageTab(page: Page): Promise<void> {
    await page.goto("/patient");
    await assertRealApiTraffic(page, "/api/v1/app/patients");

    await page.locator("tr.ant-table-row .bd-patient-name").first().click();
    await expect(page).toHaveURL(/\/patient\/[0-9a-f-]{36}/);

    await page.getByRole("tab", { name: "Hình ảnh" }).click();
  }

  test("the image tab renders its placeholder and upload button", async ({ page }) => {
    await openImageTab(page);

    // The tab should show the upload button and empty state.
    await expect(page.getByRole("button", { name: "Tải ảnh" })).toBeVisible();
    await expect(page.getByText("Không có ảnh trong bộ lọc đã chọn")).toBeVisible();
  });

  test("the image tab filter controls are present", async ({ page }) => {
    await openImageTab(page);

    // The treatment phase filter should be visible.
    await expect(page.getByText("Giai đoạn điều trị")).toBeVisible();
  });
});
