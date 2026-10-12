import { expect, test, type Locator, type Page } from "@playwright/test";
import { assertRealApiTraffic, login } from "./fixtures/auth";

/**
 * QA #37 / #39 — dropdowns in and around dialogs.
 *
 * #37: a picker opened while its dialog was still zooming in measured the
 * shrunken field, so "Chọn bác sĩ" / "Tên thuốc" opened ~50px wide off the
 * dialog's corner and stayed there. Dialogs now fade without scaling.
 *
 * #39: the account menu opened by a tap stayed over the page that "Cài đặt"
 * had just navigated to; dropdowns in a dialog close with it.
 *
 * Real stack: real login, real routes, nothing intercepted.
 */

/** The open (not hidden) select dropdowns, as their on-screen boxes. */
async function openSelectBoxes(page: Page) {
  return page.evaluate(() =>
    [...document.querySelectorAll(".ant-select-dropdown:not(.ant-select-dropdown-hidden)")].map((element) => {
      const box = element.getBoundingClientRect();
      return { x: box.x, width: box.width };
    }),
  );
}

async function openPrescriptionDialog(page: Page): Promise<Locator> {
  await page.goto("/patient");
  await assertRealApiTraffic(page, "/api/v1/app/patients");
  const href = await page.locator("table tbody tr.ant-table-row a[href*='/patient/']").first().getAttribute("href");
  expect(href, "the patient list should link to a record").toBeTruthy();
  await page.goto(`${href!.split("?")[0]}?tab=prescription`);
  await page.getByRole("button", { name: "Tạo đơn thuốc" }).click();
  return page.getByRole("dialog").filter({ hasText: "Thêm đơn thuốc" });
}

test.describe("Dropdowns in dialogs", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 900 });
    await login(page);
  });

  test("a picker opened as the dialog appears is as wide as its field and sits under it (#37)", async ({ page }) => {
    const dialog = await openPrescriptionDialog(page);
    const doctor = dialog.locator(".ant-select", { has: page.getByLabel("Chọn bác sĩ") });
    await doctor.waitFor({ state: "attached" });
    // At once, not after the dialog has settled — the moment #37 was about.
    await doctor.click({ force: true });

    await expect.poll(async () => (await openSelectBoxes(page)).length).toBe(1);
    const field = (await doctor.boundingBox())!;
    const [popup] = await openSelectBoxes(page);
    expect(Math.abs(popup.width - field.width)).toBeLessThan(2);
    expect(Math.abs(popup.x - field.x)).toBeLessThan(2);
  });

  test("Hủy closes the dialog and its open medicine list with it (#39)", async ({ page }) => {
    const dialog = await openPrescriptionDialog(page);
    await dialog.getByLabel("Tên thuốc", { exact: true }).first().click();
    await page.keyboard.type("Alpha");
    await expect.poll(async () => (await openSelectBoxes(page)).length).toBe(1);

    await dialog.getByRole("button", { name: /^Hủy|^Huỷ/ }).click();
    await expect(dialog).toBeHidden();
    await expect.poll(async () => (await openSelectBoxes(page)).length).toBe(0);
  });
});

test.describe("Account menu on a touch screen", () => {
  test.use({ hasTouch: true });

  test("picking Cài đặt by tap navigates and closes the menu (#39)", async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 900 });
    await login(page);
    await page.goto("/patient");
    await assertRealApiTraffic(page, "/api/v1/app/patients");

    await page.locator(".app-header-user").tap();
    const menu = page.locator(".ant-dropdown:not(.ant-dropdown-hidden)");
    await expect(menu).toBeVisible();
    await menu.locator(".ant-dropdown-menu-item").filter({ hasText: "Cài đặt" }).first().tap();

    await expect(page).toHaveURL(/\/settings\?tab=clinic/);
    // Past the hover-open delay that used to reopen it.
    await page.waitForTimeout(600);
    await expect(menu).toHaveCount(0);
  });
});
