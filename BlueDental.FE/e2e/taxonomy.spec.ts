import { expect, test } from "@playwright/test";
import { assertRealApiTraffic, login, runId } from "./fixtures/auth";

/**
 * Feature: Danh mục (taxonomy + catalog entries).
 *
 * Real stack only: real login, real ASP.NET Core API, real PostgreSQL. No
 * page.route(), no fulfilled responses.
 */
test.describe("Danh mục", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("creates a group and a priced service that survive a reload", async ({ page }) => {
    const id = runId();
    const groupName = `NHÓM E2E ${id}`;
    const serviceName = `Dịch vụ E2E ${id}`;

    await page.goto("/taxonomy?tab=service");
    await assertRealApiTraffic(page, "/api/v1/app/taxonomies");

    // ── Group ──────────────────────────────────────────────────────────────
    await page.getByRole("button", { name: "Thêm nhóm" }).click();
    await page.getByPlaceholder("Tên nhóm").fill(groupName);
    await page.getByRole("dialog").getByRole("button", { name: "Thêm" }).click();

    await expect(page.getByRole("button", { name: new RegExp(groupName) })).toBeVisible();

    // ── Entry ──────────────────────────────────────────────────────────────
    await page.getByRole("button", { name: /Thêm dịch vụ/ }).click();

    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Tên dịch vụ").fill(serviceName);
    await dialog.getByLabel("Mã").fill(`E2E${id}`);
    await dialog.getByLabel("Giá (đ)").fill("180000");
    await dialog.getByRole("button", { name: "Thêm" }).click();

    const row = page.getByRole("row", { name: new RegExp(serviceName) });
    await expect(row).toBeVisible();
    await expect(row).toContainText("180.000 đ");
    await expect(row).toContainText(groupName);

    // ── Persistence ────────────────────────────────────────────────────────
    await page.reload();
    await expect(page.getByRole("row", { name: new RegExp(serviceName) })).toBeVisible();
  });

  test("keeps the selected catalog in the URL", async ({ page }) => {
    await page.goto("/taxonomy?tab=medicine");
    await assertRealApiTraffic(page, "group=medication_type");

    await expect(page.getByRole("tab", { name: "Loại thuốc" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  test("states why the unmodelled catalogs are empty", async ({ page }) => {
    await page.goto("/taxonomy?tab=payment-method");

    await expect(page.getByText(/chưa dựng ở BlueDental/i)).toBeVisible();
  });
});
