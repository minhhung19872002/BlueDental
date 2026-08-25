import { expect, test } from "@playwright/test";
import { BRANCH2_USER, MANAGER_USER, login, TEST_USER } from "./fixtures/auth";

/**
 * Feature: clinic branch isolation.
 *
 * Every business entity carries a ClinicBranchId. A caller may name the branch
 * it wants — the header lets the user switch — but the server honours it only
 * when the account is allowed to work there, and refuses outright otherwise.
 * With no branch named, the list narrows to the account's own branches.
 *
 * Seeded (Development only):
 *   branch 1111…  — "admin", assigned to this branch
 *   branch 2222…  — "branch2", assigned to this branch
 *   no assignment — "manager", and therefore clinic-wide
 */
const BRANCH_ONE = "11111111-1111-1111-1111-111111111111";
const BRANCH_TWO = "22222222-2222-2222-2222-222222222222";

const BRANCH_USER = BRANCH2_USER;

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
    await login(page, MANAGER_USER);

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

  test("a branch-scoped account is refused another branch outright", async ({ page }) => {
    // admin is assigned to branch one, so branch two is not merely filtered
    // out — asking for it is refused, which is what keeps a crafted request
    // from enumerating another branch.
    await login(page);

    const refused = await apiCall(
      page,
      `/api/v1/app/taxonomies?clinicBranchId=${BRANCH_TWO}&group=care_service`,
    );
    expect(refused.status).toBe(403);
  });

  test("a branch-scoped user only sees their own branch data", async ({ page }) => {
    await login(page, BRANCH_USER);

    // Asking for the other branch is refused…
    const refused = await apiCall(
      page,
      `/api/v1/app/taxonomies?clinicBranchId=${BRANCH_ONE}&group=care_service&maxResultCount=200`,
    );
    expect(refused.status).toBe(403);

    // …and asking for its own branch answers with its own rows only.
    const own = await apiCall(
      page,
      `/api/v1/app/taxonomies?clinicBranchId=${BRANCH_TWO}&group=care_service&maxResultCount=200`,
    );
    expect(own.status).toBe(200);

    const branchIds = [...new Set(own.items.map((i) => i.clinicBranchId))];
    expect(branchIds).not.toContain(BRANCH_ONE);
  });

  test("a branch-scoped list never leaks another branch's rows", async ({ page }) => {
    await login(page, BRANCH_USER);

    // No branch named at all — the server must still narrow to the user's branch.
    const branches = await page.evaluate(async () => {
      const res = await fetch("/api/v1/app/taxonomies?maxResultCount=200", {
        headers: { accept: "application/json" },
      });
      const json = await res.json();
      return [
        ...new Set((json.items ?? []).map((t: { clinicBranchId: string }) => t.clinicBranchId)),
      ];
    });

    expect(branches).not.toContain(BRANCH_ONE);
  });

  test("the branch-one account still sees the branch-one catalogs", async ({ page }) => {
    await login(page);
    expect(TEST_USER.userName).toBe("admin");

    const count = await page.evaluate(async (branchId) => {
      const res = await fetch(
        `/api/v1/app/taxonomies?clinicBranchId=${branchId}&maxResultCount=200`,
        {
          headers: { accept: "application/json" },
        },
      );
      const json = await res.json();
      return json.totalCount ?? 0;
    }, BRANCH_ONE);

    expect(count).toBeGreaterThan(0);
  });
});
