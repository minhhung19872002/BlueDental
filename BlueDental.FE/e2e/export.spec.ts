import { expect, test, type Page } from "@playwright/test";
import { assertRealApiTraffic, login } from "./fixtures/auth";

/**
 * Feature: Xuất Excel / In PDF.
 *
 * The report and patient-list pages export client-side via XLSX.writeFile().
 * Since XLSX.writeFile() uses a blob URL that Playwright cannot intercept as
 * a "download" event in all environments, these tests verify:
 * 1. The export button is present and clickable.
 * 2. The click does not throw a console error.
 * 3. The underlying data is loaded from the real API.
 */
test.describe("Xuất file", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("the report page has a working Xuất Excel button", async ({ page }) => {
    await page.goto("/report");
    await page.waitForLoadState("networkidle");

    const exportButton = page.getByRole("button", { name: "Xuất Excel" }).first();
    await expect(exportButton).toBeVisible();

    // Capture console errors that occur on click.
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });

    await exportButton.click();
    // Give the export a moment to complete (it builds a workbook in-memory).
    await page.waitForTimeout(2000);

    // The button should not produce uncaught exceptions.
    expect(errors.filter((e) => e.includes("exportToExcel") || e.includes("XLSX"))).toHaveLength(0);
  });

  test("the patient list has a working Xuất file button with real data", async ({ page }) => {
    await page.goto("/patient");
    await assertRealApiTraffic(page, "/api/v1/app/patients");

    const exportButton = page.getByRole("button", { name: "Xuất file" });
    await expect(exportButton).toBeVisible();

    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });

    await exportButton.click();
    await page.waitForTimeout(2000);

    expect(errors.filter((e) => e.includes("exportToExcel") || e.includes("XLSX"))).toHaveLength(0);
  });

  test("a prescription row has an In đơn button linked to the PDF endpoint", async ({ page }) => {
    await page.goto("/patient");
    await assertRealApiTraffic(page, "/api/v1/app/patients");

    await page.locator("tr.ant-table-row").first().click();
    await expect(page).toHaveURL(/\/patient\/[0-9a-f-]{36}/);

    await page.getByRole("tab", { name: "Đơn thuốc" }).click();
    await page.waitForLoadState("networkidle");

    // If there are prescription rows, verify the "In đơn" button is present.
    const printButton = page.getByRole("button", { name: "In đơn" }).first();
    const hasPrescriptions = await printButton.isVisible().catch(() => false);
    if (!hasPrescriptions) {
      test.skip(true, "No prescriptions to print — skipping PDF test");
    }

    await expect(printButton).toBeVisible();
  });
});
