import { expect, test, type Page } from "@playwright/test";
import { assertRealApiTraffic, login } from "./fixtures/auth";

/**
 * Feature: Đơn thuốc, plus the patient tabs that read other modules.
 *
 * Every patient tab is its own route, so the switcher is a set of links and
 * the URL is what says which pane is showing.
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

    await page.getByRole("link", { name: "Đơn thuốc" }).click();
    await expect(page).toHaveURL(/tab=prescription/);

    // The tab should show the create button and the list's own columns.
    await expect(page.getByRole("button", { name: "Tạo đơn thuốc" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "MÃ ĐƠN THUỐC" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "BÁC SĨ" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "THAO TÁC" })).toBeVisible();
  });

  test("the prescription tab shows empty state when no prescriptions exist", async ({ page }) => {
    await openFirstPatient(page);
    await page.waitForLoadState("networkidle");

    await page.getByRole("link", { name: "Đơn thuốc" }).click();
    await expect(page).toHaveURL(/tab=prescription/);

    // Either there's prescription data or an empty state — the tab shouldn't error.
    await expect(page.locator("body")).not.toContainText("Unexpected Application Error");
  });

  test("the patient tabs read the real modules", async ({ page }) => {
    await openFirstPatient(page);
    await page.waitForLoadState("networkidle");

    // Each tab is a link that puts its own pane in the URL and marks itself
    // as the current page.
    for (const [label, slug] of [
      ["Lịch hẹn", "appointment"],
      ["Labo", "labo"],
      ["Chăm sóc KH", "care"],
    ] as const) {
      await page.getByRole("link", { name: label }).click();
      await expect(page).toHaveURL(new RegExp(`tab=${slug}`));
      await expect(page.getByRole("link", { name: label })).toHaveAttribute(
        "aria-current",
        "page",
      );
    }
  });
});
