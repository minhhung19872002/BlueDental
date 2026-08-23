import { expect, test } from "@playwright/test";
import { login, TEST_USER } from "./fixtures/auth";

/**
 * Feature: clinic branch isolation.
 *
 * Every business entity carries a ClinicBranchId and the reference scopes every
 * call by branchId. Permissions say *what* a user may do, not *where* — so a
 * branch-scoped account must be refused another branch's data even though it
 * holds the same abilities.
 *
 * Seeded by BlueDentalBranchSeedContributor (Development only):
 *   branch 1111…  — clinic-wide accounts (admin has no assignment)
 *   branch 2222…  — user "branch2", assigned to that branch only
 */
const BRANCH_ONE = "11111111-1111-1111-1111-111111111111";
const BRANCH_TWO = "22222222-2222-2222-2222-222222222222";

const BRANCH_USER = { userName: "branch2", password: "Branch@123456" };

/** Calls an API from inside the logged-in page, returning the raw status. */
async function apiStatus(page: import("@playwright/test").Page, url: string): Promise<number> {
  return page.evaluate(async (target) => {
    const res = await fetch(target, { headers: { accept: "application/json" } });
    return res.status;
  }, url);
}

test.describe("Branch isolation", () => {
  test("a clinic-wide account reaches both branches", async ({ page }) => {
    await login(page);

    expect(
      await apiStatus(page, `/api/v1/app/taxonomies?clinicBranchId=${BRANCH_ONE}&group=care_service`),
    ).toBe(200);
    expect(
      await apiStatus(page, `/api/v1/app/taxonomies?clinicBranchId=${BRANCH_TWO}&group=care_service`),
    ).toBe(200);
  });

  test("a branch-scoped account is refused another branch", async ({ page }) => {
    await page.goto("/login");
    await page.getByPlaceholder("Tên đăng nhập hoặc email").fill(BRANCH_USER.userName);
    await page.getByPlaceholder("Mật khẩu").fill(BRANCH_USER.password);
    await page.getByRole("button", { name: "Đăng nhập" }).click();
    await expect(page).not.toHaveURL(/\/login/, { timeout: 20_000 });

    // Its own branch is fine…
    expect(
      await apiStatus(page, `/api/v1/app/taxonomies?clinicBranchId=${BRANCH_TWO}&group=care_service`),
    ).toBe(200);

    // …another branch is not, on reads and on writes alike.
    expect(
      await apiStatus(page, `/api/v1/app/taxonomies?clinicBranchId=${BRANCH_ONE}&group=care_service`),
    ).toBe(403);
    expect(
      await apiStatus(page, `/api/v1/app/time-keepings/summary?clinicBranchId=${BRANCH_ONE}&workDate=2026-08-23`),
    ).toBe(403);
    expect(
      await apiStatus(page, `/api/v1/app/cash-management/balance?clinicBranchId=${BRANCH_ONE}`),
    ).toBe(403);

    const createStatus = await page.evaluate(async (branchId) => {
      const res = await fetch("/api/v1/app/taxonomies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clinicBranchId: branchId, group: "care_service", name: "Không được phép" }),
      });
      return res.status;
    }, BRANCH_ONE);

    expect(createStatus).toBe(403);
  });

  test("a branch-scoped list never leaks another branch's rows", async ({ page }) => {
    await page.goto("/login");
    await page.getByPlaceholder("Tên đăng nhập hoặc email").fill(BRANCH_USER.userName);
    await page.getByPlaceholder("Mật khẩu").fill(BRANCH_USER.password);
    await page.getByRole("button", { name: "Đăng nhập" }).click();
    await expect(page).not.toHaveURL(/\/login/, { timeout: 20_000 });

    // No branch named at all — the server must still narrow to the user's branch.
    const branches = await page.evaluate(async () => {
      const res = await fetch("/api/v1/app/taxonomies?maxResultCount=200", {
        headers: { accept: "application/json" },
      });
      const json = await res.json();
      return [...new Set((json.items ?? []).map((t: { clinicBranchId: string }) => t.clinicBranchId))];
    });

    expect(branches).not.toContain(BRANCH_ONE);
  });

  test("the clinic-wide account still sees the branch-one catalogs", async ({ page }) => {
    await login(page);
    expect(TEST_USER.userName).toBe("admin");

    const count = await page.evaluate(async (branchId) => {
      const res = await fetch(`/api/v1/app/taxonomies?clinicBranchId=${branchId}&maxResultCount=200`, {
        headers: { accept: "application/json" },
      });
      const json = await res.json();
      return json.totalCount ?? 0;
    }, BRANCH_ONE);

    expect(count).toBeGreaterThan(0);
  });
});
