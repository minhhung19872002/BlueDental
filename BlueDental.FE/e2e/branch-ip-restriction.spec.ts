import { expect, test, type Page } from "@playwright/test";
import { login } from "./fixtures/auth";
import { call } from "./fixtures/timekeepingStaff";
import {
  BRANCHES,
  RESTRICTED_PASSWORD as PASSWORD,
  newPage,
  openBranchDialog,
  setExemption,
  setUpRestricted,
  submitLogin,
  sweepLeftoverBranches,
  tearDownRestricted,
  updateRestriction,
  type RestrictedBranch,
  type RestrictedStaff,
} from "./fixtures/restrictedStaff";

/**
 * Feature: Cụm 11 mục 11 — Xác thực IP theo chi nhánh (F-51). BlueDental-local;
 * see docs/clone/pages/branch-ip-restriction.md.
 *
 * Real login screen, real API, real PostgreSQL; nothing is intercepted. Each
 * run makes its own branch and staff member so no seeded account can be
 * locked out, and the branch's list uses 203.0.113.0/24 (TEST-NET-3), which
 * no local machine ever connects from.
 */

const STAFF = "/api/v1/app/staff";
const PREFIX = "IP";
const OFFICE = "203.0.113.0/24";
const IP_REFUSED = "BlueDental:Auth:LoginIpNotAllowed";
const IP_REFUSED_TEXT = "Tài khoản này chỉ được đăng nhập từ mạng của phòng khám";

const setUp = (page: Page, alsoInBranchOne = false) =>
  setUpRestricted(page, { prefix: PREFIX, restriction: { allowedIpRanges: OFFICE }, alsoInBranchOne });

const setBranchIps = (page: Page, fixture: Awaited<ReturnType<typeof setUp>>, allowedIpRanges: string | undefined) =>
  updateRestriction(page, fixture, allowedIpRanges === undefined ? {} : { allowedIpRanges });

async function clientIp(page: Page): Promise<string> {
  const res = await call<{ ipAddress: string }>(page, "/api/v1/app/account/client-ip");
  expect(res.status).toBe(200);
  expect(res.body.ipAddress).toBeTruthy();
  return res.body.ipAddress;
}

test.describe("Xác thực IP theo chi nhánh", () => {
  test.describe.configure({ timeout: 90_000 });

  test.beforeAll(async ({ browser }) => sweepLeftoverBranches(browser, PREFIX));
  test.afterAll(async ({ browser }) => sweepLeftoverBranches(browser, PREFIX));

  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("outside the branch network the right password is refused with the reason; a wrong one says nothing more", async ({ page, browser }) => {
    const fixture = await setUp(page);
    expect(fixture.branch.allowedIpRanges).toBe(OFFICE);
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
      await tearDownRestricted(page, fixture);
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
      const accessible = await call<{ items: RestrictedBranch[] }>(page, `${BRANCHES}/accessible`);
      expect(accessible.body.items.find((b) => b.id === fixture.branch.id)?.allowedIpRanges ?? null).toBeNull();

      const listed = await newPage(browser);
      try {
        await login(listed.page, { userName: fixture.userName, password: PASSWORD });
      } finally {
        await listed.context.close();
      }

      await setBranchIps(page, fixture, OFFICE);
      expect((await setExemption(page, fixture, { allowLoginOutsideOffice: true })).allowLoginOutsideOffice).toBe(true);

      const ticked = await newPage(browser);
      try {
        await login(ticked.page, { userName: fixture.userName, password: PASSWORD });
      } finally {
        await ticked.context.close();
      }
    } finally {
      await tearDownRestricted(page, fixture);
    }
  });

  test("an entry that is not an address is refused by name and nothing is saved", async ({ page }) => {
    const fixture = await setUp(page);
    try {
      const res = await call<RestrictedBranch>(page, `${BRANCHES}/${fixture.branch.id}`, {
        method: "PUT",
        json: { name: fixture.name, allowedIpRanges: `${OFFICE}\n203.0.113.x` },
      });
      expect(res.status).toBe(403);
      expect(res.body.error?.code).toBe("BlueDental:Organizations:0007");
      expect(res.body.error?.message).toContain("203.0.113.x");

      const after = await call<RestrictedBranch>(page, `${BRANCHES}/${fixture.branch.id}`);
      expect(after.body.allowedIpRanges).toBe(OFFICE);
    } finally {
      await tearDownRestricted(page, fixture);
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
      await tearDownRestricted(page, fixture);
    }
  });

  test("the branch dialog adds the current address and the staff dialog ticks the exemption", async ({ page }) => {
    const fixture = await setUp(page, true);
    try {
      const ip = await clientIp(page);

      const dialog = await openBranchDialog(page, fixture.name);
      const ips = dialog.getByLabel("IP được phép đăng nhập");
      await expect(ips).toHaveValue(OFFICE);
      await expect(dialog.getByText(`IP hiện tại của bạn: ${ip}`)).toBeVisible();
      await dialog.getByRole("button", { name: "Thêm vào danh sách" }).click();
      await expect(ips).toHaveValue(`${OFFICE}\n${ip}`);
      await expect(dialog.getByRole("button", { name: "Đã có trong danh sách" })).toBeDisabled();
      await dialog.getByRole("button", { name: "Lưu" }).click();
      await expect(page.getByText("Cập nhật chi nhánh thành công")).toBeVisible();
      expect((await call<RestrictedBranch>(page, `${BRANCHES}/${fixture.branch.id}`)).body.allowedIpRanges).toBe(`${OFFICE}\n${ip}`);

      await page.goto("/staff");
      const staffRow = page.getByRole("row").filter({ hasText: fixture.staffName });
      await staffRow.getByRole("button").first().click();
      const staffDialog = page.getByRole("dialog");
      const exemption = staffDialog.getByRole("checkbox", { name: "Cho phép đăng nhập ngoài công ty" });
      await expect(exemption).not.toBeChecked();
      await exemption.check();
      await staffDialog.getByRole("button", { name: /Lưu/ }).click();
      await expect(staffDialog).toBeHidden();
      expect((await call<RestrictedStaff>(page, `${STAFF}/${fixture.staff.id}`)).body.allowLoginOutsideOffice).toBe(true);

      await page.reload();
      await staffRow.getByRole("button").first().click();
      await expect(page.getByRole("dialog").getByRole("checkbox", { name: "Cho phép đăng nhập ngoài công ty" })).toBeChecked();
    } finally {
      await tearDownRestricted(page, fixture);
    }
  });
});
