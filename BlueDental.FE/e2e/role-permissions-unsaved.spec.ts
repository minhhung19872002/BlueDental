import { expect, test, type Page } from "@playwright/test";
import { assertRealApiTraffic, login } from "./fixtures/auth";

/**
 * Bug 9 — [Cài đặt > Phân quyền] ticks made on one role were silently thrown
 * away when another role (or another settings tab) was opened before saving.
 *
 * Runs on the real stack. Only the last case saves, and it puts the leaf back
 * the way it found it.
 */

const DENTIST_ROLE = "dentist";
const PATIENT_READ_LEAF = "patient.read";
const UNSAVED_TITLE = "Thay đổi chưa được lưu";

async function openDentist(page: Page) {
  await page.locator(".perm-role-item").filter({ hasText: new RegExp(`^${DENTIST_ROLE}`) }).click();
  await expect(page.locator(".perm-editor-title")).toHaveText(DENTIST_ROLE);
  await page.getByPlaceholder("Tìm quyền...").fill(PATIENT_READ_LEAF);
  const leaf = page.locator(".perm-leaf").filter({ hasText: "Xem" });
  await expect(leaf).toHaveCount(1);
  return leaf.locator('input[type="checkbox"]');
}

function otherRole(page: Page) {
  return page.locator(".perm-role-item").filter({ hasNotText: new RegExp(`^${DENTIST_ROLE}`) }).first();
}

test.describe("Phân quyền — thay đổi chưa lưu", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await Promise.all([
      assertRealApiTraffic(page, "/api/v1/app/role-permission"),
      page.goto("/settings?tab=permission"),
    ]);
  });

  test("switching role with unsaved ticks asks first; Ở lại keeps them, Bỏ thay đổi drops them", async ({ page }) => {
    const box = await openDentist(page);
    const before = await box.isChecked();
    await box.click();
    await expect(box).toBeChecked({ checked: !before });

    const other = otherRole(page);
    const otherName = (await other.locator(".perm-role-name").innerText()).trim();

    await other.click();
    const dialog = page.getByRole("dialog").filter({ hasText: UNSAVED_TITLE });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(DENTIST_ROLE);

    await dialog.getByRole("button", { name: "Ở lại" }).click();
    await expect(dialog).toBeHidden();
    await expect(page.locator(".perm-editor-title")).toHaveText(DENTIST_ROLE);
    await expect(box).toBeChecked({ checked: !before });

    await other.click();
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Bỏ thay đổi" }).click();
    await expect(dialog).toBeHidden();
    await expect(page.locator(".perm-editor-title")).toHaveText(otherName);

    // Nothing reached the server: the dentist role still reads as before.
    const reopened = await openDentist(page);
    await expect(reopened).toBeChecked({ checked: before });
  });

  test("leaving the Phân quyền tab with unsaved ticks asks first", async ({ page }) => {
    const box = await openDentist(page);
    await box.click();

    await page.locator(".profile-sidebar-item").filter({ hasText: "Thông tin cá nhân" }).click();
    const dialog = page.getByRole("dialog").filter({ hasText: UNSAVED_TITLE });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Ở lại" }).click();
    await expect(page).toHaveURL(/tab=permission/);
    await expect(page.locator(".perm-editor-title")).toHaveText(DENTIST_ROLE);

    await page.locator(".profile-sidebar-item").filter({ hasText: "Thông tin cá nhân" }).click();
    await dialog.getByRole("button", { name: "Bỏ thay đổi" }).click();
    await expect(page).toHaveURL(/tab=info/);
  });

  test("no prompt when there is nothing to lose", async ({ page }) => {
    // Ticked and unticked again: no difference from the server.
    const box = await openDentist(page);
    const before = await box.isChecked();
    await box.click();
    await box.click();
    await expect(box).toBeChecked({ checked: before });
    await expect(page.getByRole("button", { name: /Lưu thay đổi/ })).toBeDisabled();

    await otherRole(page).click();
    await expect(page.getByRole("dialog").filter({ hasText: UNSAVED_TITLE })).toHaveCount(0);

    // Saved: the change is no longer pending either. Then hand it back.
    const saved = await openDentist(page);
    for (const target of [!before, before]) {
      await saved.click();
      const saveResponse = page.waitForResponse(
        (res) => res.url().includes("/permission-management/permissions") && res.request().method() === "PUT",
      );
      await page.getByRole("button", { name: /Lưu thay đổi/ }).click();
      expect((await saveResponse).ok()).toBeTruthy();
      await expect(page.getByRole("button", { name: /Lưu thay đổi/ })).toBeDisabled();
      await expect(saved).toBeChecked({ checked: target });

      await otherRole(page).click();
      await expect(page.getByRole("dialog").filter({ hasText: UNSAVED_TITLE })).toHaveCount(0);
      await expect(page.locator(".perm-editor-title")).not.toHaveText(DENTIST_ROLE);
      await openDentist(page);
      await expect(saved).toBeChecked({ checked: target });
    }
  });
});
