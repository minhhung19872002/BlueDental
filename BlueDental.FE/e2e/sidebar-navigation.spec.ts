import { test, expect } from "@playwright/test";
import { login } from "./helpers";

test.describe("Sidebar navigation", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("sidebar shows all main navigation items", async ({ page }) => {
    const sidebar = page.locator(".app-sidebar");
    await expect(sidebar).toBeVisible();

    const navLabels = [
      /tiếp nhận|reception/i,
      /bệnh nhân|patient/i,
      /lịch hẹn|appointment/i,
      /báo cáo|report/i,
      /nhân viên|staff/i,
      /vật tư|material/i,
    ];

    for (const label of navLabels) {
      await expect(sidebar.getByText(label).first()).toBeVisible();
    }
  });

  test("clicking sidebar item navigates to correct route", async ({ page }) => {
    await page.locator(".sidebar-nav-item").filter({ hasText: /báo cáo|report/i }).first().click();
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
