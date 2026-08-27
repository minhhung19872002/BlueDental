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

    await page.getByRole("button", { name: "Tạo phòng ban" }).click();

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

    // Deleting one asks first, here as in the material panel.
    await page.locator(`[data-group-menu="${departmentName}"]`).click();
    await page.getByRole("menuitem", { name: "Xoá" }).click();

    const confirm = page.getByRole("dialog");
    await expect(confirm).toContainText(departmentName);
    await confirm.getByRole("button", { name: /Xoá/ }).click();

    await expect(page.getByRole("button", { name: departmentName })).toBeHidden({
      timeout: 10_000,
    });
  });

  test("saves a material with no quantity, and finds it however it is typed", async ({
    page,
  }) => {
    const id = runId();
    const groupName = `NHÓM VT E2E ${id}`;
    // Mixed case and a word order the row does not use, so a naive
    // Contains() on the raw term cannot match it.
    const materialName = `Găng Tay E2E ${id}`;

    await page.goto("/materials/clinic");
    await assertRealApiTraffic(page, "/api/v1/app/taxonomies");

    await page.getByRole("button", { name: "Thêm nhóm phân loại" }).click();
    const groupDialog = page.getByRole("dialog");
    await groupDialog.getByLabel(/Tên phân loại/).fill(groupName);
    await groupDialog.getByRole("button", { name: /Lưu$/ }).click();
    await expect(page.getByRole("button", { name: groupName })).toHaveAttribute(
      "aria-current",
      "true",
    );

    // "Số lượng" is optional on the reference's form. Receiving nothing is not
    // a receipt, so this must record the dates and leave stock at zero rather
    // than failing the save.
    await page.getByRole("button", { name: /Thêm vật tư/ }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel(/^Tên vật tư/).fill(materialName);
    await dialog.getByLabel(/Số lượng/).fill("");
    await dialog.getByRole("button", { name: /Lưu$/ }).click();
    await expect(dialog).toBeHidden({ timeout: 10_000 });

    const row = page.getByRole("row", { name: new RegExp(materialName) });
    await expect(row).toBeVisible();
    await expect(row).toContainText("0");

    // Padded, lowercased and out of order — the server still finds it.
    await page.getByPlaceholder("Tìm kiếm").fill(`  e2e găng ${id}  `);
    await expect(page.getByRole("row", { name: new RegExp(materialName) })).toBeVisible();
  });

  test("asks before deleting a material group", async ({ page }) => {
    const id = runId();
    const groupName = `NHÓM XOÁ E2E ${id}`;

    await page.goto("/materials/clinic");
    await assertRealApiTraffic(page, "/api/v1/app/taxonomies");

    await page.getByRole("button", { name: "Thêm nhóm phân loại" }).click();
    const groupDialog = page.getByRole("dialog");
    await groupDialog.getByLabel(/Tên phân loại/).fill(groupName);
    await groupDialog.getByRole("button", { name: /Lưu$/ }).click();
    await expect(page.getByRole("button", { name: groupName })).toBeVisible();

    const openDeleteMenu = async () => {
      await page.locator(`[data-group-menu="${groupName}"]`).click();
      await page.getByRole("menuitem", { name: "Xoá" }).click();
    };

    // Backing out leaves the group alone.
    await openDeleteMenu();
    const confirm = page.getByRole("dialog");
    await expect(confirm).toContainText(groupName);
    await confirm.getByRole("button", { name: "Huỷ" }).click();
    await expect(page.getByRole("button", { name: groupName })).toBeVisible();

    // Confirming removes it, and it stays gone after a reload.
    await openDeleteMenu();
    await page.getByRole("dialog").getByRole("button", { name: /Xoá/ }).click();
    await expect(page.getByRole("button", { name: groupName })).toBeHidden({
      timeout: 10_000,
    });

    await page.reload();
    await expect(page.getByRole("button", { name: groupName })).toBeHidden();
  });

  test("keeps a department's position as a position, not a description", async ({ page }) => {
    const id = runId();
    const later = `ZZ SAU ${id}`;
    const sooner = `ZZ TRUOC ${id}`;

    await page.goto("/materials/department");
    await assertRealApiTraffic(page, "/api/v1/app/departments");

    const create = async (name: string, position: string) => {
      await page.getByRole("button", { name: "Tạo phòng ban" }).click();
      const dialog = page.getByRole("dialog");
      await dialog.getByLabel(/Tên phòng ban/).fill(name);
      await dialog.getByLabel(/Số thứ tự/).fill(position);
      await dialog.getByRole("button", { name: /Lưu$/ }).click();
      await expect(dialog).toBeHidden({ timeout: 10_000 });
    };

    // Created in the wrong order on purpose: the position, not the moment of
    // creation, decides where each lands.
    await create(later, "92");
    await create(sooner, "91");

    const positionsOf = async () => {
      const names = await page.locator(".bd-group-name").allInnerTexts();
      return [names.indexOf(sooner), names.indexOf(later)];
    };

    let [first, second] = await positionsOf();
    expect(first).toBeGreaterThanOrEqual(0);
    expect(first).toBeLessThan(second);

    // It survives a reload — the number reached its own column rather than
    // being written into the description.
    await page.reload();
    await expect(page.getByRole("button", { name: sooner })).toBeVisible();
    [first, second] = await positionsOf();
    expect(first).toBeLessThan(second);

    // Reopening shows the number back, which it could not if it had been lost.
    await page.locator(`[data-group-menu="${sooner}"]`).click();
    await page.getByRole("menuitem", { name: "Chỉnh sửa" }).click();
    await expect(page.getByRole("dialog").getByLabel(/Số thứ tự/)).toHaveValue("91");
  });

  test("Gộp số lượng vật tư folds a department's vouchers and adds them up", async ({
    page,
  }) => {
    await page.goto("/materials/department");
    await assertRealApiTraffic(page, "/api/v1/app/departments");

    // A seeded department: four vouchers drawn from two materials.
    await page.getByRole("button", { name: "Phòng khám 1" }).click();

    const rows = page.locator(".ant-table-tbody tr.ant-table-row");
    await expect(rows).toHaveCount(4);

    const quantityOf = async (index: number) =>
      Number((await rows.nth(index).locator("td").nth(3).innerText()).trim());

    const before = await Promise.all([0, 1, 2, 3].map(quantityOf));
    const total = before.reduce((sum, value) => sum + value, 0);

    await page.getByRole("button", { name: "Gộp số lượng vật tư" }).click();

    // One row per material, and nothing is lost in the folding.
    await expect(rows).toHaveCount(2);
    const after = await Promise.all([0, 1].map(quantityOf));
    expect(after.reduce((sum, value) => sum + value, 0)).toBe(total);

    // The code column says what a folded row stands for.
    await expect(rows.first()).toContainText("2 phiếu");

    // It is a view, not a write: turning it off brings the vouchers back.
    await page.getByRole("button", { name: "Gộp số lượng vật tư" }).click();
    await expect(rows).toHaveCount(4);
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
