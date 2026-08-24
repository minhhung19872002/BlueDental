import { expect, test } from "@playwright/test";
import { login, TEST_USER } from "./fixtures/auth";

/**
 * Feature: clinic branch isolation.
 *
 * Every business entity carries a ClinicBranchId. The server resolves the
 * current branch from the JWT claim — NOT from query parameters. A branch-
 * scoped user always sees their own branch's data regardless of what
 * clinicBranchId they pass in the URL.
 *
 * Seeded by BlueDentalBranchSeedContributor (Development only):
 *   branch 1111…  — clinic-wide accounts (admin has no assignment)
 *   branch 2222…  — user "branch2", assigned to that branch only
 */
const BRANCH_ONE = "11111111-1111-1111-1111-111111111111";
const BRANCH_TWO = "22222222-2222-2222-2222-222222222222";

const BRANCH_USER = { userName: "branch2", password: "Branch@123456" };

/** Calls an API from inside the logged-in page, returning the raw Response. */
async function apiCall(
  page: import("@playwright/test").Page,
  url: string,
): Promise<{ status: number; items: Array<{ clinicBranchId: string }> }> {
  return page.evaluate(async (target) => {
    const res = await fetch(target, { headers: { accept: "application/json" } });
    const json = await res.json().catch(() => ({}));
    return {
      status: res.status,
      items: json.items ?? [],
    };
  }, url);
}

test.describe("Branch isolation", () => {
  test("a clinic-wide account reaches both branches", async ({ page }) => {
    await login(page);

    const r1 = await apiCall(
      page,
      `/api/v1/app/taxonomies?clinicBranchId=${BRANCH_ONE}&group=care_service`,
    );
    expect(r1.status).toBe(200);

    const r2 = await apiCall(
      page,
      `/api/v1/app/taxonomies?clinicBranchId=${BRANCH_TWO}&group=care_service`,
    );
    expect(r2.status).toBe(200);
  });

  test("a branch-scoped user only sees their own branch data", async ({ page }) => {
    await page.goto("/login");
    await page.getByPlaceholder("Tên đăng nhập hoặc email").fill(BRANCH_USER.userName);
    await page.getByPlaceholder("Mật khẩu").fill(BRANCH_USER.password);
    await page.getByRole("button", { name: "Đăng nhập" }).click();
    await expect(page).not.toHaveURL(/\/login/, { timeout: 20_000 });

    // Even when passing BRANCH_ONE in the query, the server returns data
    // scoped to the user's JWT branch (BRANCH_TWO). Verify:
    // - the request succeeds (200)
    // - but no items belong to BRANCH_ONE
    const r = await apiCall(
      page,
      `/api/v1/app/taxonomies?clinicBranchId=${BRANCH_ONE}&group=care_service&maxResultCount=200`,
    );
    expect(r.status).toBe(200);

    const branchIds = [...new Set(r.items.map((i) => i.clinicBranchId))];
    expect(branchIds).not.toContain(BRANCH_ONE);
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
