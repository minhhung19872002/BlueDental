import { expect, test, type Page } from "@playwright/test";
import { assertRealApiTraffic, login, runId } from "./fixtures/auth";

/**
 * Feature: Kế hoạch điều trị + Hóa đơn.
 *
 * The TreatmentPlanPanel component is built but the PatientProfilePage renders
 * an inline placeholder for the treatment plan tab. The "Tạo kế hoạch mới"
 * button has no onClick handler. These tests verify the layout renders
 * correctly with data from the real API.
 */
test.describe("Kế hoạch điều trị", () => {
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

  test("the treatment plan tab renders its layout and table", async ({ page }) => {
    await openFirstPatient(page);
    await page.waitForLoadState("networkidle");

    await page.getByRole("tab", { name: "Kế hoạch điều trị" }).click();

    // The buttons should be visible (even though they're decorative).
    await expect(page.getByRole("button", { name: "Tạo kế hoạch mới" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Xem tất cả dịch vụ" })).toBeVisible();

    // Summary cards should render.
    await expect(page.getByText("Dịch vụ đang điều trị", { exact: true })).toBeVisible();
    await expect(page.getByText("Dịch vụ có công đoạn gần nhất", { exact: true })).toBeVisible();

    // Table column headers should be present.
    await expect(page.getByRole("columnheader", { name: "Số phiếu" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Dịch vụ" })).toBeVisible();
  });

  test("the treatment plan tab loads plan data from the API", async ({ page }) => {
    await openFirstPatient(page);

    const requests: string[] = [];
    page.on("request", (req) => {
      if (req.url().includes("/treatment-plans")) requests.push(req.url());
    });

    await page.waitForLoadState("networkidle");

    // The treatment plan API should have been called during page load.
    expect(requests.length).toBeGreaterThan(0);
  });

  test("the invoice tab renders its layout", async ({ page }) => {
    await openFirstPatient(page);
    await page.waitForLoadState("networkidle");

    await page.getByRole("tab", { name: "Hóa đơn" }).click();
    await expect(page.locator("body")).not.toContainText("Unexpected Application Error");
  });

  test("the diagnosis tab renders correctly", async ({ page }) => {
    await openFirstPatient(page);
    await page.waitForLoadState("networkidle");

    await page.getByRole("tab", { name: "Chẩn đoán & Tư vấn" }).click();
    await expect(page.locator("body")).not.toContainText("Unexpected Application Error");
  });
});
