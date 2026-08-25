import { expect, type Page } from "@playwright/test";

/**
 * Credentials seeded by BlueDental.DbMigrator. Acceptance tests log in through
 * the real login screen — no injected tokens, no fake localStorage — so the
 * whole auth pipeline is exercised.
 */
export const TEST_USER = {
  userName: process.env.E2E_USER ?? "admin",
  password: process.env.E2E_PASSWORD ?? "Admin@123456",
};

/** Seeded account limited to the second clinic branch, for isolation tests. */
export const BRANCH2_USER = {
  userName: "branch2",
  password: "Branch@123456",
};

/**
 * Seeded account with no branch assignment at all, so it may work in every
 * branch — the only way to exercise switching between them.
 */
export const MANAGER_USER = {
  userName: "manager",
  password: "Manager@123456",
};

/** Logs in through the UI and waits until an authenticated route has rendered. */
export async function login(
  page: Page,
  credentials: { userName: string; password: string } = TEST_USER,
): Promise<void> {
  await page.goto("/login");

  await page.getByPlaceholder("Tên đăng nhập hoặc email").fill(credentials.userName);
  await page.getByPlaceholder("Mật khẩu").fill(credentials.password);
  await page.getByRole("button", { name: "Đăng nhập" }).click();

  await expect(page).not.toHaveURL(/\/login/, { timeout: 20_000 });
}

/**
 * Fails the test if anything intercepts BlueDental API traffic. Acceptance tests
 * must hit the real backend; this guard makes an accidental mock loud.
 */
export async function assertRealApiTraffic(page: Page, urlFragment: string): Promise<void> {
  const response = await page.waitForResponse(
    (res) => res.url().includes(urlFragment) && res.request().method() === "GET",
    { timeout: 20_000 },
  );

  expect(response.ok(), `${urlFragment} should be served by the real API`).toBeTruthy();
  expect(response.request().failure()).toBeNull();
}

/** Suffix that keeps repeated runs from colliding on unique names. */
export function runId(): string {
  return `${Date.now().toString().slice(-6)}`;
}
