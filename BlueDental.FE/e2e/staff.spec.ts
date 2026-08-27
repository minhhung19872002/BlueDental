import { expect, test } from "@playwright/test";
import { assertRealApiTraffic, login, runId } from "./fixtures/auth";

/**
 * Feature: Nhân sự — create, edit, delete through StaffEditorModal.
 *
 * The dialog is built from FloatingField: no placeholders, but every input is
 * wired to a real <label>, so getByLabel is the selector of record. Labels of
 * required fields carry a trailing "*", hence the regexes. Nhóm quyền and
 * Chi nhánh are required AntD selects; the option is picked from the open
 * dropdown. The delete goes through ConfirmDeleteDialog (an AntD Modal, role
 * "dialog", red "Xoá" button).
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
    await expect(dialog).toBeVisible();

    await dialog.getByLabel(/Họ và tên/).fill(fullName);
    await dialog.getByLabel(/Email/).fill(`${userName}@bluedental.local`);
    await dialog.getByLabel(/^Mật khẩu/).fill("Nhanvien@123456");
    await dialog.getByLabel(/Nhập lại mật khẩu/).fill("Nhanvien@123456");

    // Required selects: open by clicking the labelled inner input, then pick
    // the option by its title — a closed dropdown can linger in the DOM, so
    // "first option of the open dropdown" is ambiguous while this is not.
    await dialog.getByLabel(/Nhóm quyền/).click();
    await page.locator('.ant-select-item-option[title="admin"]').click();

    // The main branch, so the new row shows up in admin's default branch list.
    await dialog.getByLabel(/Chi nhánh/).click();
    await page.locator('.ant-select-item-option[title="Nha Khoa Đức Hạnh Premium"]').click();
    // A multi-select keeps its dropdown open; clicking another field closes it.
    await dialog.getByLabel(/Họ và tên/).click();

    await dialog.getByRole("button", { name: /Lưu/ }).click();
    await expect(dialog).toBeHidden();

    const rowFor = () => page.getByRole("row").filter({ hasText: fullName });
    await expect(rowFor()).toBeVisible();

    // Edit: the phone number is optional on create, added here.
    await rowFor().getByRole("button").first().click();
    await expect(dialog).toBeVisible();
    await dialog.getByLabel(/Số điện thoại/).fill("0912345678");
    await dialog.getByRole("button", { name: /Lưu/ }).click();
    await expect(dialog).toBeHidden();

    // The edit survives a reload, i.e. it really persisted.
    await page.reload();
    await rowFor().getByRole("button").first().click();
    await expect(dialog.getByLabel(/Số điện thoại/)).toHaveValue("0912345678");
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();

    // Delete goes through the red confirmation dialog.
    await rowFor().getByRole("button").nth(1).click();
    const confirm = page.getByRole("dialog").filter({ hasText: "Xác nhận xoá" });
    // The button's accessible name is "delete Xoá" — icon alt text included.
    await confirm.getByRole("button", { name: /Xoá$/ }).click();

    await expect(rowFor()).toHaveCount(0);
    await page.reload();
    await expect(rowFor()).toHaveCount(0);
  });
});
