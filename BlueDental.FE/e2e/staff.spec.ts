import { expect, test } from "@playwright/test";
import { assertRealApiTraffic, login, runId } from "./fixtures/auth";

/**
 * Feature: Nhân viên.
 *
 * The screen used to render a hard-coded list and its buttons did nothing.
 * Staff are identity accounts, so creating one really creates a login.
 */
test.describe("Nhân viên", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("creates, edits and deletes a staff account", async ({ page }) => {
    const id = runId();
    const userName = `nv${id}`;
    const fullName = `NHAN VIEN ${id}`;

    await page.goto("/staff");
    await assertRealApiTraffic(page, "/api/v1/app/staff");

    await page.getByRole("button", { name: /Tạo/ }).first().click();
    const dialog = page.getByRole("dialog");

    await dialog.getByLabel("Tên đăng nhập").fill(userName);
    await dialog.getByLabel("Mật khẩu").fill("Nhanvien@123456");
    await dialog.getByLabel("Họ và tên").fill(fullName);
    await dialog.getByLabel("Email").fill(`${userName}@bluedental.local`);
    await dialog.getByRole("button", { name: "Tạo", exact: true }).click();
    await expect(dialog).toBeHidden();

    // Staff are cards on the roster screen, one per account.
    const cardFor = () => page.locator(".staff-card").filter({ hasText: fullName });
    await expect(cardFor()).toBeVisible();
    await expect(cardFor()).toContainText("Đang làm việc");

    // Editing goes back through the API. The card shows identity, not the
    // phone, so the saved value is read back through the form it was typed
    // into — which proves the server kept it, not just that a cell repainted.
    await cardFor().getByRole("button", { name: "Chỉnh sửa" }).click();
    await dialog.getByLabel("Số điện thoại").fill("0912345678");
    await dialog.getByRole("button", { name: "Lưu" }).click();
    await expect(dialog).toBeHidden();

    await page.reload();
    await cardFor().getByRole("button", { name: "Chỉnh sửa" }).click();
    await expect(dialog.getByLabel("Số điện thoại")).toHaveValue("0912345678");
    await dialog.getByRole("button", { name: "Huỷ" }).click();
    await expect(dialog).toBeHidden();

    // Deleting really removes the account.
    await cardFor().getByRole("button", { name: "Xoá" }).click();
    await page.getByRole("tooltip").getByRole("button", { name: "Xoá" }).click();

    await expect(cardFor()).toHaveCount(0);
    await page.reload();
    await expect(cardFor()).toHaveCount(0);
  });

  test("a weak password is refused by the server", async ({ page }) => {
    const userName = `yeu${runId()}`;

    await page.goto("/staff");
    await assertRealApiTraffic(page, "/api/v1/app/staff");

    await page.getByRole("button", { name: /Tạo/ }).first().click();
    const dialog = page.getByRole("dialog");

    await dialog.getByLabel("Tên đăng nhập").fill(userName);
    await dialog.getByLabel("Mật khẩu").fill("123");
    await dialog.getByLabel("Email").fill(`${userName}@bluedental.local`);
    await dialog.getByRole("button", { name: "Tạo", exact: true }).click();

    // The password policy lives in Identity, not in the browser.
    await expect(dialog).toBeVisible();
    await expect(page.getByRole("row", { name: new RegExp(userName) })).toHaveCount(0);
  });
});
