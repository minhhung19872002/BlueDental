import { expect, type Browser, type Page } from "@playwright/test";
import { login, runId } from "./auth";
import { call } from "./timekeepingStaff";

/**
 * Throw-away branch + staff member for the sign-in restriction specs (Cụm 11
 * mục 11 IP, mục 13 hours). Each run gets its own pair so no seeded account
 * can be locked out; everything goes through the real API from inside a page
 * logged in through the login screen.
 */

export const BRANCHES = "/api/v1/app/clinic-branches";
export const STAFF = "/api/v1/app/staff";
export const RESTRICTED_PASSWORD = "Restrict@123456";
/** Admin's default branch: the staff list only shows staff working there. */
export const BRANCH_ONE = "11111111-1111-1111-1111-111111111111";

export interface RestrictedBranch {
  id: string;
  name: string;
  allowedIpRanges: string | null;
  usageStartTime: string | null;
  usageEndTime: string | null;
}

export interface RestrictedStaff {
  id: string;
  allowLoginOutsideOffice: boolean;
  allowLoginOutsideHours: boolean;
}

export interface RestrictedFixture {
  branch: RestrictedBranch;
  staff: RestrictedStaff;
  userName: string;
  staffName: string;
  name: string;
}

interface SetUpOptions {
  /** Names the branch `CN <prefix> <run>` so the sweeper can find leftovers. */
  prefix: string;
  /** Restriction fields sent with the new branch. */
  restriction: Partial<Pick<RestrictedBranch, "allowedIpRanges" | "usageStartTime" | "usageEndTime">>;
  alsoInBranchOne?: boolean;
}

export async function setUpRestricted(page: Page, options: SetUpOptions): Promise<RestrictedFixture> {
  const id = runId();
  const name = `CN ${options.prefix} ${id}`;
  const branch = await call<RestrictedBranch>(page, BRANCHES, {
    method: "POST",
    json: { code: `${options.prefix}${id}`, name, ...options.restriction },
  });
  expect(branch.status).toBe(200);

  const userName = `${options.prefix.toLowerCase()}${id}`;
  const staffName = `Nhân viên ${options.prefix} ${id}`;
  const staff = await call<RestrictedStaff>(page, STAFF, {
    method: "POST",
    json: {
      userName,
      password: RESTRICTED_PASSWORD,
      name: staffName,
      email: `${userName}@bluedental.local`,
      roleNames: ["dentist"],
      branchIds: options.alsoInBranchOne ? [branch.body.id, BRANCH_ONE] : [branch.body.id],
      isActive: true,
    },
  });
  expect(staff.status).toBe(200);
  expect(staff.body.allowLoginOutsideOffice).toBe(false);
  expect(staff.body.allowLoginOutsideHours).toBe(false);

  return { branch: branch.body, staff: staff.body, userName, staffName, name };
}

export async function tearDownRestricted(page: Page, fixture: RestrictedFixture) {
  await call(page, `${STAFF}/${fixture.staff.id}`, { method: "DELETE" });
  await call(page, `${BRANCHES}/${fixture.branch.id}`, { method: "DELETE" });
}

/** PUTs the branch with only its name and the given restriction fields. */
export async function updateRestriction(
  page: Page,
  fixture: RestrictedFixture,
  restriction: SetUpOptions["restriction"],
) {
  const res = await call<RestrictedBranch>(page, `${BRANCHES}/${fixture.branch.id}`, {
    method: "PUT",
    json: { name: fixture.name, ...restriction },
  });
  expect(res.status).toBe(200);
  return res.body;
}

/** Sets one exemption tick on the throw-away staff member, keeping the rest. */
export async function setExemption(
  page: Page,
  fixture: RestrictedFixture,
  tick: Partial<Pick<RestrictedStaff, "allowLoginOutsideOffice" | "allowLoginOutsideHours">>,
) {
  const current = await call<RestrictedStaff>(page, `${STAFF}/${fixture.staff.id}`);
  const res = await call<RestrictedStaff>(page, `${STAFF}/${fixture.staff.id}`, {
    method: "PUT",
    json: { ...current.body, password: undefined, ...tick },
  });
  expect(res.status).toBe(200);
  return (await call<RestrictedStaff>(page, `${STAFF}/${fixture.staff.id}`)).body;
}

/** Fills the real login form; does not assume where it lands. */
export async function submitLogin(page: Page, userName: string, password: string) {
  await page.goto("/login");
  await page.getByPlaceholder("Tên đăng nhập hoặc email").fill(userName);
  await page.getByPlaceholder("Mật khẩu").fill(password);
  await page.getByRole("button", { name: "Đăng nhập" }).click();
}

export async function newPage(browser: Browser) {
  const context = await browser.newContext();
  return { context, page: await context.newPage() };
}

/**
 * A run cut short (timeout, crash) never reaches its finally block, and a
 * branch left holding a restriction would lock every clinic-wide non-admin
 * account out of later specs (R-789). Sweep `CN <prefix> <n>` branches with a
 * fresh admin session before and after.
 */
export async function sweepLeftoverBranches(browser: Browser, prefix: string) {
  const { context, page } = await newPage(browser);
  try {
    await login(page);
    const list = await call<{ items: RestrictedBranch[] }>(
      page,
      `${BRANCHES}?Filter=${encodeURIComponent(`CN ${prefix}`)}&MaxResultCount=1000`,
    );
    const pattern = new RegExp(`^CN ${prefix} \\d+$`);
    for (const branch of list.body.items ?? []) {
      if (pattern.test(branch.name)) {
        await call(page, `${BRANCHES}/${branch.id}`, { method: "DELETE" });
      }
    }
  } finally {
    await context.close();
  }
}

/** Opens the branch dialog for a branch on Cài đặt → Danh sách chi nhánh. */
export async function openBranchDialog(page: Page, branchName: string) {
  await page.goto("/settings?tab=branches");
  // Oldest first, so the new branch sits on the last page once the table is in.
  await expect(page.locator("tbody tr.ant-table-row").first()).toBeVisible();
  const pages = page.locator(".ant-pagination-item");
  if ((await pages.count()) > 1) await pages.last().click();
  await page.locator("tbody tr.ant-table-row").filter({ hasText: branchName }).getByRole("button").first().click();
  return page.getByRole("dialog");
}
