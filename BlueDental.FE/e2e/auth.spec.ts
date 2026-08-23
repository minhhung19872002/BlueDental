import { test, expect } from "@playwright/test";
import { login, TEST_USER } from "./helpers";

test.describe("Authentication", () => {
  test("redirects unauthenticated user to login", async ({ page }) => {
    await page.goto("/reception");
    await expect(page).toHaveURL(/\/login/);
  });

  test("logs in with valid credentials", async ({ page }) => {
    await login(page);
    await expect(page).toHaveURL(/\/reception/);
  });

  test("shows error on invalid credentials", async ({ page }) => {
    await page.goto("/login");
    await page.getByPlaceholder(/tên đăng nhập|username/i).fill("invalid_user");
    await page.getByPlaceholder(/mật khẩu|password/i).fill("wrong_password");
    await page.getByRole("button", { name: /đăng nhập|login|sign in/i }).click();
    await expect(page.locator(".ant-message-error, .ant-alert-error, [role='alert']")).toBeVisible({ timeout: 10000 });
  });

  test("logs out successfully", async ({ page }) => {
    await login(page);
    await page.locator(".app-header-user").click();
    await page.getByText(/đăng xuất|sign out/i).click();
    await expect(page).toHaveURL(/\/login/);
  });
});
