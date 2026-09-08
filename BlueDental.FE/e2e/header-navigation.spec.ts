import { test, expect } from "@playwright/test";
import { login } from "./fixtures/auth";

/**
 * The v2 design has no rail: the menu is four groups along the header, each
 * opening a ribbon of its members directly underneath.
 */
test.describe("Header navigation", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("the header carries the four menu groups", async ({ page }) => {
    for (const label of ["Tổng quan", "Phòng khám", "Tài chính", "Vận hành"]) {
      await expect(page.locator(`.app-nav-group[title="${label}"]`)).toBeVisible();
    }

    // Nothing of the old rail is left behind it.
    await expect(page.locator(".app-sidebar")).toHaveCount(0);
  });

  test("a group opens a ribbon of its own members", async ({ page }) => {
    await page.locator('.app-nav-group[title="Tài chính"]').click();

    const ribbon = page.locator(".app-ribbon");
    await expect(ribbon).toBeVisible();
    await expect(ribbon.locator(".app-ribbon-item")).toHaveText([
      "Thanh toán",
      "Voucher",
      "Báo cáo",
    ]);
  });

  test("a group that is a destination navigates instead of opening", async ({ page }) => {
    await page.locator('.app-nav-group[title="Tổng quan"]').click();

    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.locator(".app-ribbon")).toHaveCount(0);
  });

  test("choosing from the ribbon navigates and closes it", async ({ page }) => {
    await page.locator('.app-nav-group[title="Tài chính"]').click();
    await page.locator('.app-ribbon-item[title="Báo cáo"]').click();

    await expect(page).toHaveURL(/\/report/);
    await expect(page.locator(".app-ribbon")).toHaveCount(0);
  });

  test("another group swaps the ribbon, the same group leaves it open", async ({ page }) => {
    await page.locator('.app-nav-group[title="Vận hành"]').click();
    await expect(page.locator('.app-ribbon-item[title="Labo"]')).toBeVisible();

    await page.locator('.app-nav-group[title="Phòng khám"]').click();
    await expect(page.locator('.app-ribbon-item[title="Labo"]')).toHaveCount(0);
    await expect(page.locator('.app-ribbon-item[title="Tiếp nhận"]')).toBeVisible();

    // A second click on the group already open must not toggle it shut.
    await page.locator('.app-nav-group[title="Phòng khám"]').click();
    await expect(page.locator('.app-ribbon-item[title="Tiếp nhận"]')).toBeVisible();
  });

  test("Escape and a click outside both close the ribbon", async ({ page }) => {
    await page.locator('.app-nav-group[title="Vận hành"]').click();
    await page.keyboard.press("Escape");
    await expect(page.locator(".app-ribbon")).toHaveCount(0);

    await page.locator('.app-nav-group[title="Vận hành"]').click();
    await page.locator(".app-nav-backdrop").click();
    await expect(page.locator(".app-ribbon")).toHaveCount(0);
  });

  test("the sheet that closes the menu never covers the bar", async ({ page }) => {
    await page.locator('.app-nav-group[title="Vận hành"]').click();

    const header = await page.locator(".app-header").boundingBox();
    // Measured on the bar, not on the ribbon: the ribbon opens with a slide, so
    // its own box sits up to 10px low for the first frames.
    const bar = await page.locator(".app-topbar").boundingBox();
    const backdrop = await page.locator(".app-nav-backdrop").boundingBox();

    expect(header).not.toBeNull();
    expect(bar).not.toBeNull();
    expect(backdrop).not.toBeNull();
    // Otherwise the second click of a group-to-group switch lands on the sheet.
    expect(backdrop!.y).toBeGreaterThanOrEqual(bar!.y + bar!.height - 1);
    expect(header!.x).toBe(0);
    expect(header!.width).toBe(page.viewportSize()!.width);
  });

  test("below 1100px the groups give way to the drawer", async ({ page }) => {
    await page.setViewportSize({ width: 1000, height: 800 });

    await expect(page.locator(".app-nav")).toBeHidden();
    await page.locator(".app-header-burger").click();

    const drawer = page.locator(".app-drawer-item");
    await expect(drawer.first()).toBeVisible();
    await expect(drawer).toHaveCount(14);

    await page.locator('.app-drawer-item[title="Vật tư"]').click();
    await expect(page).toHaveURL(/\/materials/);
    await expect(page.locator(".app-drawer-item").first()).toBeHidden();
  });

  test("language switcher toggles between Vietnamese and English", async ({ page }) => {
    await expect(page.locator(".app-header-lang")).toHaveText("VI");

    await page.locator(".app-header-lang").click();
    await page.getByText("English", { exact: true }).click();
    await expect(page.locator(".app-header-lang")).toHaveText("EN");

    await page.locator(".app-header-lang").click();
    await page.getByText("Tiếng Việt", { exact: true }).click();
    await expect(page.locator(".app-header-lang")).toHaveText("VI");
  });
});
