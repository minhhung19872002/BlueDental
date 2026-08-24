import { expect, test } from "@playwright/test";
import { login, runId } from "./fixtures/auth";

/**
 * Feature: Vật tư phòng khám.
 *
 * Verifies the materials page loads its inventory from the real API
 * and can create new supplies that persist after reload.
 */
test.describe("Vật tư", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("the materials page loads and displays the inventory list", async ({ page }) => {
    await page.goto("/materials");
    await page.waitForLoadState("networkidle");

    await expect(page.locator("body")).not.toContainText("Unexpected Application Error");
    await expect(page.getByRole("button", { name: "Thêm vật tư" })).toBeVisible();
  });

  test("adds a supply that survives a reload", async ({ page }) => {
    const id = runId();
    const supplyName = `Vật tư E2E ${id}`;

    await page.goto("/materials");
    await page.waitForLoadState("networkidle");

    await page.getByRole("button", { name: "Thêm vật tư" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    await dialog.getByLabel("Mã vật tư").fill(`VT${id}`);
    await dialog.getByLabel("Tên vật tư").fill(supplyName);
    await dialog.getByRole("button", { name: "Thêm vật tư" }).click();

    await expect(dialog).toBeHidden({ timeout: 10_000 });

    const row = page.getByRole("row", { name: new RegExp(supplyName) });
    await expect(row).toBeVisible();

    // It survives a reload — data reached PostgreSQL.
    await page.reload();
    await expect(page.getByRole("row", { name: new RegExp(supplyName) })).toBeVisible();
  });
});
