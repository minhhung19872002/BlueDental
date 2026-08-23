import type { Page } from "@playwright/test";

export const TEST_USER = {
  username: process.env.E2E_USERNAME ?? "admin",
  password: process.env.E2E_PASSWORD ?? "1q2w3E*",
};

export async function login(page: Page) {
  await page.goto("/login");
  await page.getByPlaceholder(/tên đăng nhập|username/i).fill(TEST_USER.username);
  await page.getByPlaceholder(/mật khẩu|password/i).fill(TEST_USER.password);
  await page.getByRole("button", { name: /đăng nhập|login|sign in/i }).click();
  await page.waitForURL("**/reception", { timeout: 15000 });
}
