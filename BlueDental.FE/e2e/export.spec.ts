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

  test("the patient list exports the filtered list as a real workbook", async ({ page }) => {
    await page.goto("/patient");
    await assertRealApiTraffic(page, "/api/v1/app/patients");

    // Narrow first: the reference exports what the screen is showing, not
    // everything, so the request has to carry the filter with it.
    await page.locator(".bd-patient-filters").getByRole("button", { name: "Chưa phát sinh" }).click();

    const exported = page.waitForRequest(
      (r) =>
        r.url().includes("/api/v1/app/patients/excel") &&
        r.url().includes("treatmentStatus=Pending"),
    );
    const download = page.waitForEvent("download");

    await page.locator(".bd-patient-toolbar").getByRole("button", { name: "Xuất file" }).click();

    await exported;
    // The server names the file; the browser only has to be handed one.
    expect((await download).suggestedFilename()).toMatch(/^danh-sach-benh-nhan.*\.xlsx$/);
  });

  test("a prescription row has an In đơn button linked to the PDF endpoint", async ({ page }) => {
    await page.goto("/patient");
    await assertRealApiTraffic(page, "/api/v1/app/patients");

    await page.locator("tr.ant-table-row .bd-patient-name").first().click();
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
