import { test, expect } from "@playwright/test";
import { login } from "./fixtures/auth";

/**
 * The v2 design has no rail: the menu is four groups along the header, with a
 * ribbon of one group's members always directly underneath.
 */
test.describe("Header navigation", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("signing in opens Tiếp nhận", async ({ page }) => {
    await expect(page).toHaveURL(/\/reception$/);

    // The bare address resolves the same way, not only the sign-in form.
    await page.goto("/");
    await expect(page).toHaveURL(/\/reception$/);
  });

  test("the header carries the four menu groups, Phòng khám first", async ({ page }) => {
    await expect(page.locator(".app-nav-group")).toHaveText([
      "Phòng khám",
      "Tổng quan",
      "Tài chính",
      "Vận hành",
    ]);

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

  /* BA (2026-10-05): the ribbon is always on — the page's own group by default,
     empty for a group without members. */
  test("the ribbon is always on, showing the page's own group", async ({ page }) => {
    const ribbon = page.locator(".app-ribbon");
    await expect(ribbon).toBeVisible();
    await expect(ribbon.locator(".app-ribbon-item--active")).toHaveText("Tiếp nhận");
    // offsetHeight, which no transform touches, rather than the drawn box.
    const full = await ribbon.evaluate((el) => (el as HTMLElement).offsetHeight);

    await page.locator('.app-nav-group[title="Tổng quan"]').click();
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(ribbon).toBeVisible();
    await expect(ribbon.locator(".app-ribbon-item")).toHaveCount(0);

    // Empty, it keeps the height it had with items, so the page does not jump.
    const empty = await ribbon.evaluate((el) => (el as HTMLElement).offsetHeight);
    expect(empty).toBe(full);
  });

  test("choosing from the ribbon navigates and the ribbon stays", async ({ page }) => {
    await page.locator('.app-nav-group[title="Tài chính"]').click();
    await expect(page.locator('.app-ribbon-item[title="Báo cáo"]')).toBeVisible();

    // Watch every DOM change on the bar: the page's old group (Phòng khám) must
    // not come back, even for a frame, between the click and the new page.
    await page.evaluate(() => {
      const w = window as Window & { __oldGroupFlashed?: boolean };
      w.__oldGroupFlashed = false;
      const bar = document.querySelector(".app-topbar")!;
      new MutationObserver(() => {
        if (bar.querySelector('.app-ribbon-item[title="Tiếp nhận"]')) w.__oldGroupFlashed = true;
      }).observe(bar, { childList: true, subtree: true });
    });
    await page.locator('.app-ribbon-item[title="Báo cáo"]').click();

    await expect(page).toHaveURL(/\/report/);
    expect(
      await page.evaluate(() => (window as Window & { __oldGroupFlashed?: boolean }).__oldGroupFlashed),
    ).toBe(false);
    await expect(page.locator(".app-ribbon-item--active")).toHaveText("Báo cáo");
    await expect(page.locator(".app-ribbon-item")).toHaveText(["Thanh toán", "Voucher", "Báo cáo"]);
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

  test("Escape takes the ribbon back to the page's own group", async ({ page }) => {
    await page.locator('.app-nav-group[title="Vận hành"]').click();
    await expect(page.locator('.app-ribbon-item[title="Labo"]')).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(page.locator('.app-ribbon-item[title="Labo"]')).toHaveCount(0);
    await expect(page.locator(".app-ribbon-item--active")).toHaveText("Tiếp nhận");
  });

  test("the ribbon is part of the bar, not a popup over the page", async ({ page }) => {
    await page.locator('.app-nav-group[title="Vận hành"]').click();

    // No click-catcher: a click on the page goes to the page.
    await expect(page.locator(".app-nav-backdrop")).toHaveCount(0);

    const header = await page.locator(".app-header").boundingBox();
    expect(header!.x).toBe(0);
    expect(header!.width).toBe(page.viewportSize()!.width);
  });

  test("below 1100px the groups give way to the drawer", async ({ page }) => {
    await page.setViewportSize({ width: 1000, height: 800 });

    await expect(page.locator(".app-nav")).toBeHidden();
    await expect(page.locator(".app-ribbon")).toBeHidden();
    await page.locator(".app-header-burger").click();

    const drawer = page.locator(".app-drawer-item");
    await expect(drawer.first()).toBeVisible();
    await expect(drawer).toHaveCount(14);

    await page.locator('.app-drawer-item[title="Vật tư"]').click();
    await expect(page).toHaveURL(/\/materials/);
    await expect(page.locator(".app-drawer-item").first()).toBeHidden();
  });

  /* The header carries no language control of its own any more: the account
     menu is the only way to switch, on every screen size. */
  test("the account menu toggles between Vietnamese and English", async ({ page }) => {
    const clinicGroup = page.locator(".app-nav-group").first();
    await expect(clinicGroup).toHaveText("Phòng khám");

    await expect(page.locator(".app-header-lang")).toHaveCount(0);

    await page.locator(".app-header-user").click();
    await page.getByRole("menuitem", { name: "Ngôn ngữ" }).hover();
    await page.getByRole("menuitem", { name: "English", exact: true }).click();
    await expect(clinicGroup).toHaveText("Clinic");

    await page.locator(".app-header-user").click();
    await page.getByRole("menuitem", { name: "Language" }).hover();
    await page.getByRole("menuitem", { name: "Tiếng Việt", exact: true }).click();
    await expect(clinicGroup).toHaveText("Phòng khám");
  });
});
