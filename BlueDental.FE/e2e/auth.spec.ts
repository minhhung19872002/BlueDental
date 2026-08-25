import { test, expect } from "@playwright/test";
import { login, TEST_USER } from "./fixtures/auth";

test.describe("Authentication", () => {
  test("redirects unauthenticated user to login", async ({ page }) => {
    await page.goto("/reception");
    await expect(page).toHaveURL(/\/login/);
  });

  test("logs in with valid credentials", async ({ page }) => {
    await login(page);
    await expect(page).not.toHaveURL(/\/login/);
  });

  test("shows error on invalid credentials", async ({ page }) => {
    await page.goto("/login");
    await page.getByPlaceholder("Tên đăng nhập hoặc email").fill("invalid_user");
    await page.getByPlaceholder("Mật khẩu").fill("wrong_password");
    await page.getByRole("button", { name: "Đăng nhập" }).click();
    // The screen says this in its own words; it used to print ABP's enum name.
    await expect(
      page.getByText("Tên đăng nhập hoặc mật khẩu không đúng."),
    ).toBeVisible({ timeout: 10000 });
  });

  test("logs out successfully", async ({ page }) => {
    await login(page);
    await page.locator(".app-header-user").click();
    await page.getByText(/Đăng xuất/i).click();
    await expect(page).toHaveURL(/\/login/);
  });
});
