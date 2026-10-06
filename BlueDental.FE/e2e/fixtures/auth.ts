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

/**
 * Half-hour starts inside the dentist's default shifts (08-12, 13-17): a
 * booking outside them is refused (R-742), and the dialog books 30 minutes.
 */
const SHIFT_STARTS = [
  "08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
  "13:00", "13:30", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30",
] as const;

/** How many days past the 400-day margin a slot may land on. */
const SLOT_DAY_SPREAD = 3000;

/**
 * A slot far enough out that the seed data has nothing on it, and different on
 * every run — the run id picks both the day and the half hour — so a re-run
 * does not collide with the booking an earlier one left behind: the server
 * rejects a double booking, correctly. Bookings pile up run after run and the
 * run id repeats every ~17 minutes, so the grid is wide (3000 days x 16 starts)
 * to keep a repeat landing on an old booking rare (R-759). `offsetDays` keeps
 * one run's bookings apart.
 */
export function freeSlot(runSuffix: string, offsetDays: number): { day: string; time: string } {
  const seed = Number(runSuffix);
  const date = new Date();
  date.setDate(date.getDate() + 400 + (seed % SLOT_DAY_SPREAD) + offsetDays);
  const day = `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear()}`;
  const time = SHIFT_STARTS[Math.floor(seed / SLOT_DAY_SPREAD) % SHIFT_STARTS.length];
  return { day, time };
}
