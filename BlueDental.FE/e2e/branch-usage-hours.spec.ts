import { expect, test, type Page } from "@playwright/test";
import { login } from "./fixtures/auth";
import { call } from "./fixtures/timekeepingStaff";
import {
  BRANCHES,
  RESTRICTED_PASSWORD as PASSWORD,
  STAFF,
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
 * Feature: Cụm 11 mục 13 — Quản lý thời gian sử dụng (F-52). BlueDental-local;
 * see docs/clone/pages/usage-hours.md.
 *
 * Real login screen, real API, real PostgreSQL; nothing is intercepted. The
 * windows are built around the clinic's current time (UTC+7) so the spec runs
 * at any hour: "outside" is two to three hours ahead, "inside" spans an hour
 * either side — across midnight too, which the server reads as overnight.
 */

const PREFIX = "GIO";
const HOURS_REFUSED = "BlueDental:Auth:LoginOutsideHours";
const HOURS_REFUSED_TEXT = "Tài khoản này chỉ được dùng phần mềm trong khung giờ";

/** "HH:mm" on the clinic's wall clock, `minutes` from now. */
function clinicClock(minutes: number): string {
  const at = new Date(Date.now() + 7 * 3_600_000 + minutes * 60_000);
  return `${String(at.getUTCHours()).padStart(2, "0")}:${String(at.getUTCMinutes()).padStart(2, "0")}`;
}

const outside = () => ({ usageStartTime: clinicClock(120), usageEndTime: clinicClock(180) });
const inside = () => ({ usageStartTime: clinicClock(-60), usageEndTime: clinicClock(60) });

const setUp = (page: Page, alsoInBranchOne = false) =>
  setUpRestricted(page, { prefix: PREFIX, restriction: outside(), alsoInBranchOne });

test.describe("Quản lý thời gian sử dụng", () => {
  test.describe.configure({ timeout: 90_000 });

  test.beforeAll(async ({ browser }) => sweepLeftoverBranches(browser, PREFIX));
  test.afterAll(async ({ browser }) => sweepLeftoverBranches(browser, PREFIX));

  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("outside the branch's hours the right password is refused and the message names the window", async ({ page, browser }) => {
    const fixture = await setUp(page);
    const window = `${fixture.branch.usageStartTime}–${fixture.branch.usageEndTime}`;
    expect(fixture.branch.usageStartTime).toBe(outside().usageStartTime);
    const other = await newPage(browser);
    try {
      const [response] = await Promise.all([
        other.page.waitForResponse((r) => r.url().includes("/api/account/login")),
        submitLogin(other.page, fixture.userName, PASSWORD),
      ]);
      expect(response.status()).toBe(403);
      expect(((await response.json()) as { error: { code: string } }).error.code).toBe(HOURS_REFUSED);
      await expect(other.page.getByRole("alert")).toContainText(`${HOURS_REFUSED_TEXT} ${window}`);
      await other.page.reload();
      await expect(other.page).toHaveURL(/\/login/);
    } finally {
      await other.context.close();
      await tearDownRestricted(page, fixture);
    }
  });

  test("inside the window, or ticked for any hour, the account signs in; an unsaved field keeps the window", async ({ page, browser }) => {
    const fixture = await setUp(page);
    try {
      const now = inside();
      const saved = await updateRestriction(page, fixture, now);
      expect(saved.usageStartTime).toBe(now.usageStartTime);
      expect(saved.usageEndTime).toBe(now.usageEndTime);

      // Cài đặt → Thông tin phòng khám saves the branch without the hours; they stay.
      const kept = await updateRestriction(page, fixture, {});
      expect(kept.usageStartTime).toBe(now.usageStartTime);

      const within = await newPage(browser);
      try {
        await login(within.page, { userName: fixture.userName, password: PASSWORD });
      } finally {
        await within.context.close();
      }

      await updateRestriction(page, fixture, outside());
      expect((await setExemption(page, fixture, { allowLoginOutsideHours: true })).allowLoginOutsideHours).toBe(true);

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

  test("half a window, two equal times or an unreadable time are refused and nothing is saved", async ({ page }) => {
    const fixture = await setUp(page);
    try {
      for (const bad of [
        { usageStartTime: "06:00", usageEndTime: "" },
        { usageStartTime: "08:00", usageEndTime: "08:00" },
        { usageStartTime: "6h", usageEndTime: "20:00" },
      ]) {
        const res = await call<RestrictedBranch>(page, `${BRANCHES}/${fixture.branch.id}`, {
          method: "PUT",
          json: { name: fixture.name, ...bad },
        });
        expect(res.status, JSON.stringify(bad)).toBe(403);
        expect(res.body.error?.code).toBe("BlueDental:Organizations:0008");
      }

      const after = await call<RestrictedBranch>(page, `${BRANCHES}/${fixture.branch.id}`);
      expect(after.body.usageStartTime).toBe(fixture.branch.usageStartTime);

      // Both blank clears the window: the account signs in at any hour again.
      const cleared = await updateRestriction(page, fixture, { usageStartTime: "", usageEndTime: "" });
      expect(cleared.usageStartTime).toBeNull();
      expect(cleared.usageEndTime).toBeNull();
    } finally {
      await tearDownRestricted(page, fixture);
    }
  });

  test("a session still open when the window closes is ended, and the login screen says why", async ({ page, browser }) => {
    test.setTimeout(180_000);
    const fixture = await setUp(page);
    const user = await newPage(browser);
    try {
      await updateRestriction(page, fixture, inside());
      await login(user.page, { userName: fixture.userName, password: PASSWORD });

      // The window "ends": it now lies ahead of the clinic's clock.
      await updateRestriction(page, fixture, outside());

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
        .toContain("/login?reason=hours");
      await expect(user.page.getByRole("alert")).toContainText("Bạn đã bị đăng xuất vì đã hết khung giờ được phép sử dụng phần mềm");

      const after = await call(user.page, "/api/v1/app/account/current-user");
      expect(after.status).toBe(401);
    } finally {
      await user.context.close();
      await tearDownRestricted(page, fixture);
    }
  });

  test("the branch dialog edits the window and the staff dialog ticks the exemption", async ({ page }) => {
    const fixture = await setUp(page, true);
    try {
      const dialog = await openBranchDialog(page, fixture.name);
      const start = dialog.getByLabel("Từ");
      const end = dialog.getByLabel("Đến");
      await expect(start).toHaveValue(fixture.branch.usageStartTime ?? "");
      await expect(end).toHaveValue(fixture.branch.usageEndTime ?? "");

      // Half a window is caught before it reaches the server.
      await end.click();
      await page.locator(".ant-picker-clear").last().click({ force: true });
      await dialog.getByRole("button", { name: "Lưu" }).click();
      await expect(dialog.getByText("Nhập đủ cả giờ bắt đầu và giờ kết thúc").first()).toBeVisible();

      await start.click();
      await start.fill("07:00");
      await start.press("Enter");
      await end.click();
      await end.fill("19:30");
      await end.press("Enter");
      await dialog.getByRole("button", { name: "Lưu" }).click();
      await expect(page.getByText("Cập nhật chi nhánh thành công")).toBeVisible();

      const saved = (await call<RestrictedBranch>(page, `${BRANCHES}/${fixture.branch.id}`)).body;
      expect([saved.usageStartTime, saved.usageEndTime]).toEqual(["07:00", "19:30"]);

      await page.goto("/staff");
      const staffRow = page.getByRole("row").filter({ hasText: fixture.staffName });
      await staffRow.getByRole("button").first().click();
      const staffDialog = page.getByRole("dialog");
      const exemption = staffDialog.getByRole("checkbox", { name: "Cho phép dùng ngoài giờ" });
      await expect(exemption).not.toBeChecked();
      await exemption.check();
      await staffDialog.getByRole("button", { name: /Lưu/ }).click();
      await expect(staffDialog).toBeHidden();
      const staff = (await call<RestrictedStaff>(page, `${STAFF}/${fixture.staff.id}`)).body;
      expect(staff.allowLoginOutsideHours).toBe(true);
      expect(staff.allowLoginOutsideOffice).toBe(false);

      await page.reload();
      await staffRow.getByRole("button").first().click();
      await expect(page.getByRole("dialog").getByRole("checkbox", { name: "Cho phép dùng ngoài giờ" })).toBeChecked();
    } finally {
      await tearDownRestricted(page, fixture);
    }
  });
});
