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
    await expect(page.getByRole("tab", { name: "Chọn Răng" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Hàm Trên" })).toBeVisible();
    await expect(page.getByTestId("selected-teeth")).toContainText("Chưa chọn răng");
  });

  test("the dental chart on the diagnosis tab responds to tooth clicks", async ({ page }) => {
    await openFirstPatient(page);
    await page.waitForLoadState("networkidle");

    await page.getByRole("link", { name: "Chẩn đoán & Tư vấn" }).click();
    await page.locator(".pd-diagnosis-card .pd-card-title").getByRole("button").click();

    // Click a tooth and it shows up as a chip under "Răng đã chọn".
    const chips = page.getByTestId("selected-teeth").locator(".pd-tooth-chip");
    const tooth11 = page.getByRole("button", { name: "Răng 11", exact: true });
    await tooth11.click();
    await expect(chips).toHaveText(["11"]);

    // Click again to deselect.
    await tooth11.click();
    await expect(chips).toHaveCount(0);
    await expect(page.getByTestId("selected-teeth")).toContainText("Chưa chọn răng");

    // "Hàm Trên" picks the whole upper jaw as one chip; the chart folds away.
    await page.getByRole("tab", { name: "Hàm Trên" }).click();
    await expect(chips).toHaveText(["Hàm trên"]);
    await expect(page.getByRole("button", { name: "Răng 11", exact: true })).toHaveCount(0);
  });
});
