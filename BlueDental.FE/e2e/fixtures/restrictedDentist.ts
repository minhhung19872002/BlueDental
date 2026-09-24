import { expect, type Browser, type Locator, type Page } from "@playwright/test";
import { assertRealApiTraffic, login } from "./auth";

/**
 * A second, restricted account for permission tests: a member of the seeded
 * `dentist` role, which carries no grants, created through the real Nhân sự
 * dialog and signed in through the real login screen in its own context.
 * Every leaf a test grants must be reset by that test.
 */

export const DENTIST_ROLE = "dentist";
export const MAIN_BRANCH = "Nha Khoa Đức Hạnh Premium";

/**
 * The checkboxes of one leaf on the dentist's grant tree, found by its id. A
 * subject can sit under two groups (`appointment` is both Điều trị → Lịch hẹn
 * and Lịch hẹn → Lịch hẹn khách hàng), so the same leaf may appear twice; a
 * toggle through the first must then flip every match, which is how
 * `setDentistLeaf` proves the matches are one leaf and not a lookalike id.
 */
export async function openDentistLeaf(page: Page, leaf: string) {
  await page.goto("/settings?tab=permission");
  await page.locator(".perm-role-item").filter({ hasText: DENTIST_ROLE }).click();
  await expect(page.locator(".perm-editor-title")).toHaveText(DENTIST_ROLE);

  await page.getByPlaceholder("Tìm quyền...").fill(leaf);
  const boxes = page.locator('.perm-leaf input[type="checkbox"]');
  await expect(boxes.first()).toBeVisible();
  return boxes;
}

async function expectEveryBox(boxes: Locator, checked: boolean) {
  const count = await boxes.count();
  for (let index = 0; index < count; index += 1) {
    await expect(boxes.nth(index)).toBeChecked({ checked });
  }
}

export async function setDentistLeaf(page: Page, leaf: string, granted: boolean) {
  const boxes = await openDentistLeaf(page, leaf);
  if ((await boxes.first().isChecked()) === granted) {
    await expectEveryBox(boxes, granted);
    return;
  }

  await boxes.first().click();
  await page.getByRole("button", { name: /Lưu thay đổi/ }).click();
  await expect(page.getByText("Lưu quyền thành công")).toBeVisible();
  await expectEveryBox(boxes, granted);
}

export async function resetDentistLeaves(page: Page, leaves: readonly string[]) {
  for (const leaf of leaves) await setDentistLeaf(page, leaf, false);
}

export async function createDentist(page: Page, fullName: string, userName: string, password: string) {
  await page.goto("/staff");
  await assertRealApiTraffic(page, "/api/v1/app/staff");
  await page.getByRole("button", { name: /Tạo/ }).first().click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();

  await dialog.getByLabel(/Họ và tên/).fill(fullName);
  await dialog.getByLabel(/Email/).fill(`${userName}@bluedental.local`);
  await dialog.getByLabel(/^Mật khẩu/).fill(password);
  await dialog.getByLabel(/Nhập lại mật khẩu/).fill(password);
  await dialog.getByLabel(/Nhóm quyền/).click();
  await page.locator(`.ant-select-item-option[title="${DENTIST_ROLE}"]`).click();
  await dialog.getByLabel(/Chi nhánh/).click();
  await page.locator(`.ant-select-item-option[title="${MAIN_BRANCH}"]`).click();
  await dialog.getByLabel(/Họ và tên/).click();
  await dialog.getByRole("button", { name: /Lưu/ }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("row").filter({ hasText: fullName })).toBeVisible();
}

export async function deleteDentist(page: Page, fullName: string) {
  await page.goto("/staff");
  const row = page.getByRole("row").filter({ hasText: fullName });
  await expect(row).toBeVisible();
  await row.getByRole("button").nth(1).click();
  const confirm = page.getByRole("dialog").filter({ hasText: "Xác nhận xoá" });
  await confirm.getByRole("button", { name: /Xoá$/ }).click();
  await expect(row).toHaveCount(0);
}

export async function openDentistSession(browser: Browser, userName: string, password: string) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await login(page, { userName, password });
  return { context, page };
}
