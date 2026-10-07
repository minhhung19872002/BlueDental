import { expect, test, type Browser, type Page } from "@playwright/test";
import { login, runId } from "./fixtures/auth";
import { call } from "./fixtures/timekeepingStaff";

/**
 * Feature: Cụm 11 mục 11 — Xác thực IP theo chi nhánh (F-50). BlueDental-local;
 * see docs/clone/pages/branch-ip-restriction.md.
 *
 * Real login screen, real API, real PostgreSQL; nothing is intercepted. Each
 * run makes its own branch and staff member so no seeded account can be
 * locked out, and the branch's list uses 203.0.113.0/24 (TEST-NET-3), which
 * no local machine ever connects from.
 */

const BRANCHES = "/api/v1/app/clinic-branches";
const STAFF = "/api/v1/app/staff";
const OFFICE = "203.0.113.0/24";
const IP_REFUSED = "BlueDental:Auth:LoginIpNotAllowed";
const IP_REFUSED_TEXT = "Tài khoản này chỉ được đăng nhập từ mạng của phòng khám";
const PASSWORD = "IpCheck@123456";
/** Admin's default branch: the staff list only shows staff working there. */
const BRANCH_ONE = "11111111-1111-1111-1111-111111111111";

interface Branch {
  id: string;
  allowedIpRanges: string | null;
}

interface Staff {
  id: string;
  allowLoginOutsideOffice: boolean;
}

interface Fixture {
  branch: Branch;
  staff: Staff;
  userName: string;
  staffName: string;
  name: string;
}

async function setUp(page: Page, alsoInBranchOne = false): Promise<Fixture> {
  const id = runId();
  const code = `IP${id}`;
  const name = `CN IP ${id}`;
  const branch = await call<Branch>(page, BRANCHES, {
    method: "POST",
    json: { code, name, allowedIpRanges: OFFICE },
  });
  expect(branch.status).toBe(200);
  expect(branch.body.allowedIpRanges).toBe(OFFICE);

  const userName = `ip${id}`;
  const staffName = `Nhân viên IP ${id}`;
  const staff = await call<Staff>(page, STAFF, {
    method: "POST",
    json: {
      userName,
      password: PASSWORD,
      name: staffName,
      email: `${userName}@bluedental.local`,
      roleNames: ["dentist"],
      branchIds: alsoInBranchOne ? [branch.body.id, BRANCH_ONE] : [branch.body.id],
      isActive: true,
    },
  });
  expect(staff.status).toBe(200);
  expect(staff.body.allowLoginOutsideOffice).toBe(false);

  return { branch: branch.body, staff: staff.body, userName, staffName, name };
}

async function tearDown(page: Page, fixture: Fixture) {
  await call(page, `${STAFF}/${fixture.staff.id}`, { method: "DELETE" });
  await call(page, `${BRANCHES}/${fixture.branch.id}`, { method: "DELETE" });
}

/** Fills the real login form; does not assume where it lands. */
async function submitLogin(page: Page, userName: string, password: string) {
  await page.goto("/login");
  await page.getByPlaceholder("Tên đăng nhập hoặc email").fill(userName);
  await page.getByPlaceholder("Mật khẩu").fill(password);
  await page.getByRole("button", { name: "Đăng nhập" }).click();
}

async function newPage(browser: Browser) {
  const context = await browser.newContext();
  return { context, page: await context.newPage() };
}

async function setBranchIps(page: Page, fixture: Fixture, allowedIpRanges: string | undefined) {
  const res = await call<Branch>(page, `${BRANCHES}/${fixture.branch.id}`, {
    method: "PUT",
    json: { name: fixture.name, ...(allowedIpRanges === undefined ? {} : { allowedIpRanges }) },
  });
  expect(res.status).toBe(200);
  return res.body;
}

/**
 * A run cut short (timeout, crash) never reaches its finally block, and a
 * branch left holding 203.0.113.0/24 would lock every clinic-wide account out
 * of later specs. Sweep them with a fresh admin session before and after.
 */
async function sweepLeftoverBranches(browser: Browser) {
  const { context, page } = await newPage(browser);
  try {
    await login(page);
    const list = await call<{ items: (Branch & { name: string })[] }>(
      page,
      `${BRANCHES}?Filter=${encodeURIComponent("CN IP")}&MaxResultCount=1000`,
    );
    for (const branch of list.body.items ?? []) {
      if (/^CN IP \d+$/.test(branch.name)) {
        await call(page, `${BRANCHES}/${branch.id}`, { method: "DELETE" });
      }
    }
  } finally {
    await context.close();
  }
}

async function clientIp(page: Page): Promise<string> {
  const res = await call<{ ipAddress: string }>(page, "/api/v1/app/account/client-ip");
  expect(res.status).toBe(200);
  expect(res.body.ipAddress).toBeTruthy();
  return res.body.ipAddress;
}

test.describe("Xác thực IP theo chi nhánh", () => {
  test.describe.configure({ timeout: 90_000 });

  test.beforeAll(async ({ browser }) => sweepLeftoverBranches(browser));
  test.afterAll(async ({ browser }) => sweepLeftoverBranches(browser));

  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("outside the branch network the right password is refused with the reason; a wrong one says nothing more", async ({ page, browser }) => {
    const fixture = await setUp(page);
    const other = await newPage(browser);
    try {
      await submitLogin(other.page, fixture.userName, "Wrong@123456");
      await expect(other.page.getByRole("alert")).toBeVisible();
      await expect(other.page.getByRole("alert")).not.toContainText(IP_REFUSED_TEXT);

      const [response] = await Promise.all([
        other.page.waitForResponse((r) => r.url().includes("/api/account/login")),
        submitLogin(other.page, fixture.userName, PASSWORD),
      ]);
      expect(response.status()).toBe(403);
      expect(((await response.json()) as { error: { code: string } }).error.code).toBe(IP_REFUSED);
      await expect(other.page.getByRole("alert")).toContainText(IP_REFUSED_TEXT);
      await other.page.reload();
      await expect(other.page).toHaveURL(/\/login/);
    } finally {
      await other.context.close();
      await tearDown(page, fixture);
    }
  });

  test("listing the address the server sees, or ticking the exemption, lets the account in", async ({ page, browser }) => {
    const fixture = await setUp(page);
    try {
      const ip = await clientIp(page);

      // Typed loosely; stored one per line, host bits cleared.
      const saved = await setBranchIps(page, fixture, ` 203.0.113.9/24, ${ip} `);
      expect(saved.allowedIpRanges).toBe(`${OFFICE}\n${ip}`);

      // Cài đặt → Thông tin phòng khám saves the branch without the field; the list stays.
      const kept = await setBranchIps(page, fixture, undefined);
      expect(kept.allowedIpRanges).toBe(`${OFFICE}\n${ip}`);

      // The header's branch list is for everyone and carries no networks.
      const accessible = await call<{ items: Branch[] }>(page, `${BRANCHES}/accessible`);
      expect(accessible.body.items.find((b) => b.id === fixture.branch.id)?.allowedIpRanges ?? null).toBeNull();

      const listed = await newPage(browser);
      try {
        await login(listed.page, { userName: fixture.userName, password: PASSWORD });
      } finally {
        await listed.context.close();
      }

      await setBranchIps(page, fixture, OFFICE);
      const staff = await call<Staff>(page, `${STAFF}/${fixture.staff.id}`);
      const exempt = await call<Staff>(page, `${STAFF}/${fixture.staff.id}`, {
        method: "PUT",
        json: {
          ...staff.body,
          password: undefined,
          allowLoginOutsideOffice: true,
        },
      });
      expect(exempt.status).toBe(200);
      expect((await call<Staff>(page, `${STAFF}/${fixture.staff.id}`)).body.allowLoginOutsideOffice).toBe(true);

      const ticked = await newPage(browser);
      try {
        await login(ticked.page, { userName: fixture.userName, password: PASSWORD });
      } finally {
        await ticked.context.close();
      }
    } finally {
      await tearDown(page, fixture);
    }
  });

  test("an entry that is not an address is refused by name and nothing is saved", async ({ page }) => {
    const fixture = await setUp(page);
    try {
      const res = await call<Branch>(page, `${BRANCHES}/${fixture.branch.id}`, {
        method: "PUT",
        json: { name: fixture.name, allowedIpRanges: `${OFFICE}\n203.0.113.x` },
      });
      expect(res.status).toBe(403);
      expect(res.body.error?.code).toBe("BlueDental:Organizations:0007");
      expect(res.body.error?.message).toContain("203.0.113.x");

      const after = await call<Branch>(page, `${BRANCHES}/${fixture.branch.id}`);
      expect(after.body.allowedIpRanges).toBe(OFFICE);
    } finally {
      await tearDown(page, fixture);
    }
  });

  test("a session that carries on after its address leaves the list is ended, and the login screen says why", async ({ page, browser }) => {
    test.setTimeout(180_000);
    const fixture = await setUp(page);
    const user = await newPage(browser);
    try {
      await setBranchIps(page, fixture, `${OFFICE}\n${await clientIp(page)}`);
      await login(user.page, { userName: fixture.userName, password: PASSWORD });

      await setBranchIps(page, fixture, OFFICE);

      // The decision is cached for a minute per account and address.
      await expect
        .poll(
          async () => {
            await user.page.goto("/");
            await user.page.waitForLoadState("networkidle");
            return user.page.url();
          },
          { timeout: 120_000, intervals: [10_000] },
        )
        .toContain("/login?reason=ip");
      await expect(user.page.getByRole("alert")).toContainText("Bạn đã bị đăng xuất vì đang dùng mạng ngoài phòng khám");

      // The cookie went with it: the next call is simply unauthenticated.
      const after = await call(user.page, "/api/v1/app/account/current-user");
      expect(after.status).toBe(401);
    } finally {
      await user.context.close();
      await tearDown(page, fixture);
    }
  });

  test("the branch dialog adds the current address and the staff dialog ticks the exemption", async ({ page }) => {
    const fixture = await setUp(page, true);
    try {
      const ip = await clientIp(page);

      await page.goto("/settings?tab=branches");
      // Oldest first, so the new branch sits on the last page once the table is in.
      await expect(page.locator("tbody tr.ant-table-row").first()).toBeVisible();
      const pages = page.locator(".ant-pagination-item");
      if ((await pages.count()) > 1) await pages.last().click();
      const branchRow = page.locator("tbody tr.ant-table-row").filter({ hasText: fixture.name });
      await branchRow.getByRole("button").first().click();

      const dialog = page.getByRole("dialog");
      const ips = dialog.getByLabel("IP được phép đăng nhập");
      await expect(ips).toHaveValue(OFFICE);
      await expect(dialog.getByText(`IP hiện tại của bạn: ${ip}`)).toBeVisible();
      await dialog.getByRole("button", { name: "Thêm vào danh sách" }).click();
      await expect(ips).toHaveValue(`${OFFICE}
${ip}`);
      await expect(dialog.getByRole("button", { name: "Đã có trong danh sách" })).toBeDisabled();
      await dialog.getByRole("button", { name: "Lưu" }).click();
      await expect(page.getByText("Cập nhật chi nhánh thành công")).toBeVisible();
      expect((await call<Branch>(page, `${BRANCHES}/${fixture.branch.id}`)).body.allowedIpRanges).toBe(`${OFFICE}
${ip}`);

      await page.goto("/staff");
      const staffRow = page.getByRole("row").filter({ hasText: fixture.staffName });
      await staffRow.getByRole("button").first().click();
      const staffDialog = page.getByRole("dialog");
      const exemption = staffDialog.getByRole("checkbox", { name: "Cho phép đăng nhập ngoài công ty" });
      await expect(exemption).not.toBeChecked();
      await exemption.check();
      await staffDialog.getByRole("button", { name: /Lưu/ }).click();
      await expect(staffDialog).toBeHidden();
      expect((await call<Staff>(page, `${STAFF}/${fixture.staff.id}`)).body.allowLoginOutsideOffice).toBe(true);

      await page.reload();
      await staffRow.getByRole("button").first().click();
      await expect(page.getByRole("dialog").getByRole("checkbox", { name: "Cho phép đăng nhập ngoài công ty" })).toBeChecked();
    } finally {
      await tearDown(page, fixture);
    }
  });
});
