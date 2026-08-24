import { expect, test } from "@playwright/test";
import { assertRealApiTraffic, login, runId } from "./fixtures/auth";

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

    await dialog.getByPlaceholder("Họ và tên").fill(fullName);
    await dialog.getByPlaceholder("Email").fill(`${userName}@bluedental.local`);
    await dialog.locator("input[type='password']").first().fill("Nhanvien@123456");
    await dialog.locator("input[type='password']").nth(1).fill("Nhanvien@123456");
    await dialog.getByRole("button", { name: /Lưu/ }).click();
    await expect(dialog).toBeHidden();

    const rowFor = () => page.getByRole("row").filter({ hasText: fullName });
    await expect(rowFor()).toBeVisible();

    await rowFor().getByRole("button").first().click();
    await dialog.getByPlaceholder("Số điện thoại").fill("0912345678");
    await dialog.getByRole("button", { name: /Lưu/ }).click();
    await expect(dialog).toBeHidden();

    await page.reload();
    await rowFor().getByRole("button").first().click();
    await expect(dialog.getByPlaceholder("Số điện thoại")).toHaveValue("0912345678");
    await dialog.getByRole("button", { name: /×|close/i }).or(dialog.locator("[data-close]")).click().catch(() => {
      page.keyboard.press("Escape");
    });

    await rowFor().getByRole("button").nth(1).click();
    const confirmDialog = page.getByRole("alertdialog");
    await confirmDialog.getByRole("button", { name: "Xoá" }).click();

    await expect(rowFor()).toHaveCount(0);
    await page.reload();
    await expect(rowFor()).toHaveCount(0);
  });
});
