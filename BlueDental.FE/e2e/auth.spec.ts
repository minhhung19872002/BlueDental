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

  /**
   * Opening the sign-in screen with the session still good used to park you on
   * the form: the cookie was valid, `current-user` answered 200, and nothing
   * moved you along. It read as "I signed in and it threw me back to login".
   */
  test("an open session opening /login is carried into the application", async ({ page }) => {
    await login(page);
    await page.goto("/login");

    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.locator('input[type="password"]')).toHaveCount(0);
    await expect(page.locator(".app-header-user")).toBeVisible();

    // And the form is still there for whoever is not signed in.
    await page.locator(".app-header-user").click();
    await page.getByText(/Đăng xuất/i).click();
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole("button", { name: "Đăng nhập" })).toBeVisible();
  });
});
