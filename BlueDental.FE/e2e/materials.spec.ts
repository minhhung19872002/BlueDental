import { expect, test } from "@playwright/test";
import { assertRealApiTraffic, login, runId } from "./fixtures/auth";

/**
 * Feature: Vật tư phòng khám.
 *
 * The rule worth protecting is the derived "Trạng thái": expiry outranks stock
 * level, so a full shelf of expired stock must never read as "Còn hàng".
 */
test.describe("Vật tư", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("adds a supply, receives stock, and derives its status from expiry", async ({ page }) => {
    const id = runId();
    const groupName = `NHÓM VT ${id}`;
    const supplyName = `Vật tư E2E ${id}`;

    await page.goto("/materials");
    await assertRealApiTraffic(page, "/api/v1/app/inventory-items");

    // ── Group ──────────────────────────────────────────────────────────────
    await page.getByRole("button", { name: "Thêm Mới" }).click();
    await page.getByPlaceholder("Tên nhóm").fill(groupName);
    await page.getByRole("dialog").getByRole("button", { name: "Thêm" }).click();
    await expect(page.getByRole("button", { name: new RegExp(groupName) })).toBeVisible();

    // ── Supply ─────────────────────────────────────────────────────────────
    await page.getByRole("button", { name: "Thêm vật tư" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Mã vật tư").fill(`VT${id}`);
    await dialog.getByLabel("Tên vật liệu").fill(supplyName);
    await dialog.getByLabel("Giá nhập (đ)").fill("120000");
    await dialog.getByLabel("Giá bán (đ)").fill("150000");
    await dialog.getByLabel("Mức tồn tối thiểu").fill("10");
    await dialog.getByRole("button", { name: "Thêm" }).click();

    const row = page.getByRole("row", { name: new RegExp(supplyName) });
    await expect(row).toBeVisible();

    // Nothing received yet, so it is out of stock.
    await expect(row).toContainText("Hết hàng");
    await expect(row).toContainText("120.000 đ");

    // ── Receipt with a near expiry ─────────────────────────────────────────
    await row.getByRole("button", { name: "Nhập kho" }).click();
    const receiveDialog = page.getByRole("dialog");
    await receiveDialog.getByLabel("Số lượng nhập").fill("50");

    const soon = new Date();
    soon.setDate(soon.getDate() + 10);
    const expiry = receiveDialog.getByLabel("Hạn sử dụng");
    await expiry.fill(
      `${String(soon.getDate()).padStart(2, "0")}/${String(soon.getMonth() + 1).padStart(2, "0")}/${soon.getFullYear()}`,
    );
    await expiry.press("Enter");
    await receiveDialog.getByRole("button", { name: "Nhập kho" }).click();

    // Stock is plentiful, but the batch expires inside the warning window.
    await expect(row).toContainText("Sắp hết hạn");
    await expect(row).not.toContainText("Hết hàng");

    await page.reload();
    await expect(page.getByRole("row", { name: new RegExp(supplyName) })).toContainText("Sắp hết hạn");
  });
});
