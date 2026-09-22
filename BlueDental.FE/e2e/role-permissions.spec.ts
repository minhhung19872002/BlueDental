import { expect, test, type Browser, type Page } from "@playwright/test";
import { assertRealApiTraffic, login, runId } from "./fixtures/auth";

/**
 * Feature: Phân quyền theo vai trò — what a role is granted is what its users
 * can reach.
 *
 * Runs against the real stack only: the dentist account is created through the
 * Nhân sự dialog, its role's grants are changed through the Phân quyền tab,
 * and the dentist's own browser session (a second context, real cookie login)
 * is what proves the menu, the routes and the API agree with those grants.
 *
 * The seeded `dentist` role carries no grants. The spec resets its
 * "Khách hàng > Xem" leaf at the start (a previous failed run may have left it
 * on) and at the end, so the role is handed back the way it was found.
 */

const DENTIST_ROLE = "dentist";
const PATIENT_READ_LEAF = "patient.read";
const MAIN_BRANCH = "Nha Khoa Đức Hạnh Premium";

/** The `Xem` checkbox of Khách hàng on the dentist's grant tree. */
async function openDentistPatientRead(page: Page) {
  await page.goto("/settings?tab=permission");
  await page.locator(".perm-role-item").filter({ hasText: DENTIST_ROLE }).click();
  await expect(page.locator(".perm-editor-title")).toHaveText(DENTIST_ROLE);

  // Searching by id narrows the tree to that one leaf, whichever depth it sits at.
  await page.getByPlaceholder("Tìm quyền...").fill(PATIENT_READ_LEAF);
  const leaf = page.locator(".perm-leaf").filter({ hasText: "Xem" });
  await expect(leaf).toHaveCount(1);
  return leaf.locator('input[type="checkbox"]');
}

async function setDentistPatientRead(page: Page, granted: boolean) {
  const box = await openDentistPatientRead(page);
  if ((await box.isChecked()) === granted) return;

  await box.click();
  await page.getByRole("button", { name: /Lưu thay đổi/ }).click();
  await expect(page.getByText("Lưu quyền thành công")).toBeVisible();
  await expect(box).toBeChecked({ checked: granted });
}

async function openDentistSession(browser: Browser, userName: string, password: string) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await login(page, { userName, password });
  return { context, page };
}

test.describe("Phân quyền theo vai trò", () => {
  test("a role's grants decide the menu, the routes and the API", async ({ page, browser }) => {
    test.setTimeout(180_000);

    const id = runId();
    const userName = `bs${id}`;
    const password = "Bacsi@123456";
    const fullName = `BAC SI ${id}`;

    await login(page);
    await setDentistPatientRead(page, false);

    // ── admin creates a dentist through the real Nhân sự dialog ──────────
    await page.goto("/staff");
    await assertRealApiTraffic(page, "/api/v1/app/staff");
    await page.getByRole("button", { name: /Tạo/ }).first().click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    await dialog.getByLabel(/Họ và tên/).fill(fullName);
    // The username is the local part of the email — see StaffEditorModal.
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

    // ── the dentist, with nothing granted ─────────────────────────────────
    const dentist = await openDentistSession(browser, userName, password);
    try {
      // Login lands on the one screen every account may see.
      await expect(dentist.page).toHaveURL(/\/dashboard/);

      // The header shows only that screen; the other three groups are gone,
      // not merely disabled.
      await expect(dentist.page.locator(".app-nav-group")).toHaveCount(1);
      await expect(dentist.page.locator('.app-nav-group[title="Tổng quan"]')).toBeVisible();
      for (const hidden of ["Phòng khám", "Tài chính", "Vận hành"]) {
        await expect(dentist.page.locator(`.app-nav-group[title="${hidden}"]`)).toHaveCount(0);
      }

      // A typed URL is refused on the page itself…
      await dentist.page.goto("/patient");
      await expect(dentist.page.getByText("Không có quyền truy cập")).toBeVisible();
      await expect(dentist.page.locator(".patient-list, .ant-table")).toHaveCount(0);

      // …the settings tab that draws the grant tree is hidden and refused…
      await dentist.page.goto("/settings?tab=permission");
      await expect(dentist.page.getByText("Không có quyền truy cập")).toBeVisible();
      await expect(dentist.page.locator(".perm-role-list")).toHaveCount(0);

      // …and the server refuses the data behind it, whatever the browser draws.
      const tree = await dentist.page.request.get("/api/v1/app/role-permission/permission-tree");
      expect(tree.status()).toBe(403);
      const patients = await dentist.page.request.get("/api/v1/app/patients?maxResultCount=1");
      expect(patients.status()).toBe(403);

      // ── admin grants Khách hàng > Xem to the role ───────────────────────
      await setDentistPatientRead(page, true);

      // ── the same dentist session, after a reload ────────────────────────
      await dentist.page.goto("/dashboard");
      await expect(dentist.page.locator('.app-nav-group[title="Phòng khám"]')).toBeVisible();
      await dentist.page.locator('.app-nav-group[title="Phòng khám"]').click();
      await expect(dentist.page.locator(".app-ribbon .app-ribbon-item")).toHaveText(["Bệnh nhân"]);

      await dentist.page.locator('.app-ribbon-item[title="Bệnh nhân"]').click();
      await expect(dentist.page).toHaveURL(/\/patient/);
      await assertRealApiTraffic(dentist.page, "/api/v1/app/patients");
      await expect(dentist.page.getByText("Không có quyền truy cập")).toHaveCount(0);

      // Still nothing beyond what was granted.
      const stillRefused = await dentist.page.request.get("/api/v1/app/role-permission/permission-tree");
      expect(stillRefused.status()).toBe(403);
    } finally {
      await dentist.context.close();

      // Hand the role and the roster back the way they were found.
      await setDentistPatientRead(page, false);
      await page.goto("/staff");
      const row = page.getByRole("row").filter({ hasText: fullName });
      await expect(row).toBeVisible();
      await row.getByRole("button").nth(1).click();
      const confirm = page.getByRole("dialog").filter({ hasText: "Xác nhận xoá" });
      await confirm.getByRole("button", { name: /Xoá$/ }).click();
      await expect(row).toHaveCount(0);
    }
  });
});
