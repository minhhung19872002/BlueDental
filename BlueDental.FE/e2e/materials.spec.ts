import { expect, test } from "@playwright/test";
import { assertRealApiTraffic, login, runId } from "./fixtures/auth";

/**
 * Feature: Vật tư — the three sections the reference gives it.
 *
 * Real stack only: real login, real ASP.NET Core API, real PostgreSQL. No
 * page.route(), no fulfilled responses.
 */
test.describe("Vật tư", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("opens on Vật tư phòng khám and offers all three sections", async ({ page }) => {
    await page.goto("/materials");
    await assertRealApiTraffic(page, "/api/v1/app/taxonomies");

    // A bare /materials lands on the first section, as the reference does.
    for (const label of ["Vật tư phòng khám", "Phân bổ vật tư", "Phòng ban"]) {
      await expect(page.getByRole("link", { name: label })).toBeVisible();
    }

    await expect(page.getByText("Nhóm vật tư")).toBeVisible();
    await expect(page.getByRole("button", { name: /Sync data hệ thống/ })).toBeDisabled();
  });

  test("files a material under a group and both survive a reload", async ({ page }) => {
    const id = runId();
    const groupName = `NHÓM VT E2E ${id}`;
    const materialName = `Vật tư E2E ${id}`;

    await page.goto("/materials/clinic");
    await assertRealApiTraffic(page, "/api/v1/app/taxonomies");

    // ── Group ──────────────────────────────────────────────────────────────
    await page.getByRole("button", { name: "Thêm nhóm phân loại" }).click();

    const groupDialog = page.getByRole("dialog");
    await groupDialog.getByLabel(/Tên phân loại/).fill(groupName);
    await groupDialog.getByRole("button", { name: /Lưu$/ }).click();

    // Creating a group selects it, which is what unlocks "Thêm vật tư".
    await expect(page.getByRole("button", { name: groupName })).toHaveAttribute(
      "aria-current",
      "true",
    );

    // ── Material ───────────────────────────────────────────────────────────
    const addMaterial = page.getByRole("button", { name: /Thêm vật tư/ });
    await expect(addMaterial).toBeEnabled();
    await addMaterial.click();

    const dialog = page.getByRole("dialog");
    await dialog.getByLabel(/^Tên vật tư/).fill(materialName);
    await dialog.getByLabel(/Số lượng/).fill("25");
    await dialog.getByLabel(/Nhà sản xuất/).fill("E2E Supplier");
    await dialog.getByLabel(/Xuất xứ/).fill("Việt Nam");
    await dialog.getByRole("button", { name: /Lưu$/ }).click();
    await expect(dialog).toBeHidden({ timeout: 10_000 });

    const row = page.getByRole("row", { name: new RegExp(materialName) });
    await expect(row).toBeVisible();
    // It was filed under the group the panel had selected.
    await expect(row).toContainText(groupName);
    await expect(row).toContainText("25");

    // It survives a reload — the material reached PostgreSQL.
    await page.reload();
    await expect(page.getByRole("row", { name: new RegExp(materialName) })).toBeVisible();
  });

  test("creates a department that survives a reload", async ({ page }) => {
    const id = runId();
    const departmentName = `PHÒNG BAN E2E ${id}`;

    await page.goto("/materials/department");
    await assertRealApiTraffic(page, "/api/v1/app/departments");

    await expect(page.getByPlaceholder("Tìm phòng ban...")).toBeVisible();
    // Nothing is selected yet, so the table says to pick one.
    await expect(page.getByText("Chọn phòng ban để xem vật tư đã phân bổ")).toBeVisible();

    await page.getByRole("button", { name: "Thêm phòng ban" }).click();

    const dialog = page.getByRole("dialog");
    await dialog.getByLabel(/Tên phòng ban/).fill(departmentName);
    await dialog.getByRole("button", { name: /Lưu$/ }).click();
    await expect(dialog).toBeHidden({ timeout: 10_000 });

    // Creating one selects it, so the table turns to that department's issues.
    const row = page.getByRole("button", { name: departmentName });
    await expect(row).toHaveAttribute("aria-current", "true");
    await expect(page.getByText("Chọn phòng ban để xem vật tư đã phân bổ")).toBeHidden();

    // It survives a reload — the department reached PostgreSQL.
    await page.reload();
    await expect(page.getByRole("button", { name: departmentName })).toBeVisible();
  });

  test("Phân bổ vật tư lists real vouchers with no group panel", async ({ page }) => {
    await page.goto("/materials/allocation");
    await assertRealApiTraffic(page, "/api/v1/app/material-allocations");

    // The reference gives this section the full width — no panel beside it.
    await expect(page.getByPlaceholder("Tìm nhóm vật tư...")).toBeHidden();
    await expect(page.getByPlaceholder("Tìm phiếu phân bổ...")).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Mã phân bổ" })).toBeVisible();
  });
});
