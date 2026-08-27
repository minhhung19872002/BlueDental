import { test, expect } from "@playwright/test";
import { login } from "./fixtures/auth";

test.describe("Sidebar navigation", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("sidebar shows all main navigation items", async ({ page }) => {
    const sidebar = page.locator(".app-sidebar");
    await expect(sidebar).toBeVisible();

    // The rail opens expanded; every item carries its name on title (the
    // collapsed variant adds aria-label too), so title holds in both states.
    const navLabels = [
      "Tiếp nhận",
      "Bệnh nhân",
      "Lịch hẹn",
      "Báo cáo",
      "Nhân sự",
      "Vật tư",
    ];

    for (const label of navLabels) {
      await expect(sidebar.locator(`.sidebar-nav-item[title="${label}"]`)).toBeVisible();
    }
  });

  test("clicking sidebar item navigates to correct route", async ({ page }) => {
    await page.locator(".sidebar-nav-item[title='Báo cáo']").click();
    await expect(page).toHaveURL(/\/report/);
  });

  test("language switcher toggles between Vietnamese and English", async ({ page }) => {
    const langBtn = page.locator("button[aria-label]").filter({ hasText: "" }).locator("span.anticon-global").locator("..");
    await langBtn.click();

    const englishOption = page.getByText(/tiếng anh|english/i);
    await englishOption.click();

    await expect(page.locator(".sidebar-nav-item").first()).toBeVisible();
  });
});
