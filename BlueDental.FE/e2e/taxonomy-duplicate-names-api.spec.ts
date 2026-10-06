import { expect, test, type Page } from "@playwright/test";
import { login, runId } from "./fixtures/auth";

/**
 * Bug list 2026-10-06 (Danh mục > Dịch vụ):
 *  1. A group could be created with the name of an existing one.
 *  2. A service could be created twice under the same name in one group.
 * Both are now refused by the server, ignoring case and the spaces around the
 * name — the rule the Excel import already matches rows by.
 *
 * Real HTTP from a page logged in through the login screen; every check that
 * nothing was saved is a separate read.
 */

const TAXONOMIES = "/api/v1/app/taxonomies";
const ENTRIES = "/api/v1/app/catalog-entries";
const BRANCH_ONE = "11111111-1111-1111-1111-111111111111";
const BRANCH_TWO = "22222222-2222-2222-2222-222222222222";

interface Reply<T> {
  status: number;
  body: T & { error?: { code?: string; message?: string } };
}

async function call<T>(page: Page, method: string, url: string, body?: unknown, branch = BRANCH_ONE): Promise<Reply<T>> {
  return page.evaluate(
    async ({ method, url, body, branch }) => {
      const xsrf = document.cookie
        .split("; ")
        .find((c) => c.startsWith("XSRF-TOKEN="))
        ?.substring("XSRF-TOKEN=".length);
      const init: RequestInit = {
        method,
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "Accept-Language": "vi",
          "X-Clinic-Branch-Id": branch,
          ...(xsrf ? { RequestVerificationToken: decodeURIComponent(xsrf) } : {}),
        },
      };
      if (body !== undefined) init.body = JSON.stringify(body);
      const res = await fetch(url, init);
      const text = await res.text();
      return { status: res.status, body: (text ? JSON.parse(text) : {}) as never };
    },
    { method, url, body, branch },
  );
}

/**
 * Groups made here sit last (priority 9999): a group at the top is the one a
 * tab opens on and other specs add their rows to, and an empty one there would
 * leave their tables blank.
 */
const LAST = 9999;

const createGroup = (page: Page, name: string, group = "care_service", branch = BRANCH_ONE) =>
  call<{ id: string; name: string }>(page, "POST", TAXONOMIES, { clinicBranchId: branch, group, name, sortOrder: LAST }, branch);

/** Removes the empty groups a test made, so repeated runs leave nothing behind. */
const dropGroups = async (page: Page, groups: { id: string; branch: string }[]) => {
  for (const group of groups) await call(page, "DELETE", `${TAXONOMIES}/${group.id}`, undefined, group.branch);
};

const createService = (page: Page, taxonomyId: string, name: string) =>
  call<{ id: string; name: string }>(page, "POST", ENTRIES, { taxonomyId, name, price: 200000, sortOrder: 0 });

async function countGroups(page: Page, name: string) {
  const res = await call<{ items: { name: string }[] }>(
    page, "GET", `${TAXONOMIES}?group=care_service&clinicBranchId=${BRANCH_ONE}&filter=${encodeURIComponent(name)}&maxResultCount=100`,
  );
  return res.body.items.filter((g) => g.name.toLowerCase() === name.toLowerCase()).length;
}

test.describe("Danh mục — không cho tạo trùng tên", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto("/taxonomy/service");
  });

  test("bug 1: a group named like an existing one is refused, case and spaces aside", async ({ page }) => {
    const name = `NHA KHOA TỔNG QUÁT ${runId()}`;
    const first = await createGroup(page, `  ${name}  `);
    expect(first.status).toBe(200);
    // Stored without the spaces around it.
    expect(first.body.name).toBe(name);

    for (const twin of [name, name.toLowerCase(), `   ${name.toLowerCase()}   `]) {
      const again = await createGroup(page, twin);
      expect(again.status, twin).toBeGreaterThanOrEqual(400);
      expect(again.body.error?.code).toBe("BlueDental:Catalogs:0030");
      expect(again.body.error?.message).toBe("Tên nhóm đã tồn tại.");
    }
    expect(await countGroups(page, name)).toBe(1);

    // Renaming another group onto it is refused the same way; keeping its own
    // name (any case) while changing nothing else is not a duplicate.
    const other = await createGroup(page, `${name} B`);
    const rename = await call(page, "PUT", `${TAXONOMIES}/${other.body.id}`, { name: name.toUpperCase(), sortOrder: LAST });
    expect(rename.body.error?.code).toBe("BlueDental:Catalogs:0030");
    const keep = await call(page, "PUT", `${TAXONOMIES}/${first.body.id}`, { name: ` ${name} `, sortOrder: LAST });
    expect(keep.status).toBe(200);

    // The rule is per catalog and per branch: the same name elsewhere is fine.
    const medicine = await createGroup(page, name, "medication_type");
    expect(medicine.status).toBe(200);
    const branchTwo = await createGroup(page, name, "care_service", BRANCH_TWO);
    expect(branchTwo.status).toBe(200);

    await dropGroups(page, [
      { id: first.body.id, branch: BRANCH_ONE },
      { id: other.body.id, branch: BRANCH_ONE },
      { id: medicine.body.id, branch: BRANCH_ONE },
      { id: branchTwo.body.id, branch: BRANCH_TWO },
    ]);
  });

  test("bug 2: a second service of the same name in one group is refused", async ({ page }) => {
    const id = runId();
    const group = await createGroup(page, `DUNG-TEST Nhom ${id}`);
    const other = await createGroup(page, `DUNG-TEST Nhom khác ${id}`);
    const name = `DUNG-TEST Dịch vụ ${id}`;

    const first = await createService(page, group.body.id, name);
    expect(first.status).toBe(200);

    for (const twin of [name, ` ${name.toUpperCase()} `]) {
      const again = await createService(page, group.body.id, twin);
      expect(again.status, twin).toBeGreaterThanOrEqual(400);
      expect(again.body.error?.code).toBe("BlueDental:Catalogs:0031");
      expect(again.body.error?.message).toBe("Tên dịch vụ đã tồn tại trong nhóm.");
    }
    const listed = await call<{ items: { name: string }[] }>(
      page, "GET", `${ENTRIES}?group=care_service&clinicBranchId=${BRANCH_ONE}&taxonomyId=${group.body.id}&maxResultCount=100`,
    );
    expect(listed.body.items.filter((e) => e.name === name)).toHaveLength(1);

    // Another group may hold the same name — the import keys rows by group too.
    const elsewhere = await createService(page, other.body.id, name);
    expect(elsewhere.status).toBe(200);

    // Moving that one into the first group would make the twin: refused.
    const move = await call(page, "PUT", `${ENTRIES}/${elsewhere.body.id}`, {
      taxonomyId: group.body.id, name, price: 200000, sortOrder: 0, isActive: true,
    });
    expect(move.body.error?.code).toBe("BlueDental:Catalogs:0031");

    // A group of another branch is not a place to move to, and the answer is
    // the same as for a group that does not exist — no name lookup happens there.
    const foreign = await createGroup(page, `DUNG-TEST Nhom CN2 ${id}`, "care_service", BRANCH_TWO);
    const crossBranch = await call(page, "PUT", `${ENTRIES}/${elsewhere.body.id}`, {
      taxonomyId: foreign.body.id, name, price: 200000, sortOrder: 0, isActive: true,
    });
    expect(crossBranch.body.error?.code).toBe("BlueDental:Catalogs:0012");
    await dropGroups(page, [{ id: foreign.body.id, branch: BRANCH_TWO }]);
  });
});
