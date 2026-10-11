import { expect, test, type Page } from "@playwright/test";
import { assertRealApiTraffic, login, runId } from "./fixtures/auth";
import { workingBranchId } from "./fixtures/branch";
import { BRANCHES, BRANCH_ONE } from "./fixtures/restrictedStaff";
import { call } from "./fixtures/timekeepingStaff";

/**
 * The address bar names the branch by its code — `?branch=BD-001` — instead
 * of the id `11111111-1111-…` the clinic read as noise. The code is editable
 * in the branch dialog, so two live branches may never share one, not even in
 * a different case, since the link is matched ignoring case — and a deleted
 * branch keeps its code.
 *
 * Real stack: real login, real ASP.NET Core API, real PostgreSQL. Every branch
 * made here is deleted again.
 */

interface Branch {
  id: string;
  code: string;
  name: string;
}

interface AbpError {
  error?: { code?: string; message?: string };
}

const DUPLICATE_CODE = "BlueDental:Organizations:0002";
const INVALID_CODE = "BlueDental:Organizations:0009";

async function createBranch(page: Page, code: string, name: string): Promise<Branch> {
  const res = await call<Branch>(page, BRANCHES, { method: "POST", json: { code, name } });
  expect(res.status).toBe(200);
  return res.body as Branch;
}

async function renameCode(page: Page, branch: Branch, code: string) {
  return call<Branch & AbpError>(page, `${BRANCHES}/${branch.id}`, {
    method: "PUT",
    json: { code, name: branch.name },
  });
}

async function deleteBranches(page: Page, branches: Branch[]) {
  for (const b of branches) await call(page, `${BRANCHES}/${b.id}`, { method: "DELETE" });
}

const branchParam = (page: Page) => new URL(page.url()).searchParams;

test("the server refuses a taken or malformed branch code, a deleted branch's included", async ({ page }) => {
  const id = runId();
  await login(page);
  const first = await createBranch(page, `URLA${id}`, `E2E mã CN A ${id}`);
  const second = await createBranch(page, `URLB${id}`, `E2E mã CN B ${id}`);
  const made = [first, second];

  try {
    // Create with another branch's code, in another case.
    const dupCreate = await call<AbpError>(page, BRANCHES, {
      method: "POST",
      json: { code: first.code.toLowerCase(), name: `E2E mã CN C ${id}` },
    });
    expect(dupCreate.status).toBe(403);
    expect(dupCreate.body.error?.code).toBe(DUPLICATE_CODE);

    // Rename onto a taken code.
    const dupRename = await renameCode(page, second, ` ${first.code.toLowerCase()} `);
    expect(dupRename.body.error?.code).toBe(DUPLICATE_CODE);

    // Spaces and accents would not read in a link.
    const malformed = await renameCode(page, second, "CN Hà Nội");
    expect(malformed.body.error?.code).toBe(INVALID_CODE);

    // Saving under its own code is not a clash with itself.
    expect((await renameCode(page, second, second.code)).status).toBe(200);

    const renamed = await renameCode(page, second, ` URLC${id} `);
    expect(renamed.status).toBe(200);
    const reread = await call<Branch>(page, `${BRANCHES}/${second.id}`);
    expect((reread.body as Branch).code).toBe(`URLC${id}`);

    // A deleted branch keeps its code: an old link to it must not open another.
    await deleteBranches(page, [first]);
    const reuse = await call<AbpError>(page, BRANCHES, {
      method: "POST",
      json: { code: first.code.toLowerCase(), name: `E2E mã CN D ${id}` },
    });
    expect(reuse.status).toBe(403);
    expect(reuse.body.error?.code).toBe(DUPLICATE_CODE);
  } finally {
    await deleteBranches(page, made);
  }
});

test("the branch dialog edits the code, flags a duplicate under the field, and the URL follows the code", async ({
  page,
}) => {
  // Two screens, three saves and two reloads: past the 30 s default.
  test.setTimeout(90_000);
  const id = runId();
  await login(page);
  const target = await createBranch(page, `URLX${id}`, `E2E URL CN X ${id}`);
  const other = await createBranch(page, `URLY${id}`, `E2E URL CN Y ${id}`);

  try {
    // ── the header names the branch by code, never by id ───────────────────
    await page.goto("/patient");
    await page.locator(".app-header-branch").click();
    const menu = page.locator(".app-popover-list");
    await menu.getByText(target.name, { exact: true }).click();
    await expect(page.locator(".app-header-branch-name")).toHaveText(target.name);
    await expect.poll(() => branchParam(page).get("branch")).toBe(target.code);
    expect(branchParam(page).has("branchId")).toBe(false);
    expect(await workingBranchId(page)).toBe(target.id);

    await page.reload();
    await expect(page.locator(".app-header-branch-name")).toHaveText(target.name);
    expect(branchParam(page).get("branch")).toBe(target.code);

    // ── the dialog: code editable, duplicate refused under the field ───────
    await Promise.all([
      assertRealApiTraffic(page, "/v1/app/clinic-branches"),
      page.goto("/settings?tab=branches"),
    ]);
    // Branches list oldest first, so this run's are on the last page.
    const rows = page.locator(".ant-table tbody tr.ant-table-row");
    await expect(rows.first()).toBeVisible();
    const pages = page.locator(".ant-pagination-item");
    if ((await pages.count()) > 1) await pages.last().click();
    const row = rows.filter({ hasText: target.name });
    await row.getByRole("button", { name: "edit" }).click();

    const dialog = page.getByRole("dialog");
    const codeField = dialog.getByLabel("Mã chi nhánh");
    await expect(codeField).toBeEnabled();
    await expect(codeField).toHaveValue(target.code);

    await codeField.fill("CN 01");
    await dialog.getByRole("button", { name: "Lưu" }).click();
    await expect(dialog.getByText(/Chỉ dùng chữ không dấu, số, dấu - hoặc _/)).toBeVisible();

    await codeField.fill(other.code.toLowerCase());
    await dialog.getByRole("button", { name: "Lưu" }).click();
    await expect(dialog.getByText(`Mã chi nhánh ${other.code.toLowerCase()} đã được chi nhánh khác sử dụng (kể cả chi nhánh đã xoá).`)).toBeVisible();
    await expect(dialog).toBeVisible();

    const newCode = `URLZ${id}`;
    await codeField.fill(newCode);
    await dialog.getByRole("button", { name: "Lưu" }).click();
    await expect(page.getByText("Cập nhật chi nhánh thành công")).toBeVisible();
    await expect(dialog).toBeHidden();
    await expect(row.locator("td").nth(1)).toHaveText(newCode);

    // The branch in the bar is the one renamed, so its new code replaces the old.
    await expect.poll(() => branchParam(page).get("branch")).toBe(newCode);

    await page.reload();
    await expect(page.locator(".app-header-branch-name")).toHaveText(target.name);
    expect(branchParam(page).get("branch")).toBe(newCode);
    expect(await workingBranchId(page)).toBe(target.id);
  } finally {
    await deleteBranches(page, [target, other]);
  }
});

test("an old ?branchId= link and a code this browser has never seen both open the right branch", async ({ page }) => {
  const id = runId();
  await login(page);
  const target = await createBranch(page, `URLL${id}`, `E2E URL CN L ${id}`);

  try {
    // Bookmarks from before the change still work, and are rewritten.
    await page.goto(`/patient?branchId=${target.id}`);
    await expect(page.locator(".app-header-branch-name")).toHaveText(target.name);
    await expect.poll(() => branchParam(page).get("branch")).toBe(target.code);
    expect(branchParam(page).has("branchId")).toBe(false);

    // A link with a code this browser has no record of — another person's
    // link, typed in lower case — waits for the branch list, then lands.
    await page.evaluate(() => window.localStorage.removeItem("bd-current-branch-id"));
    await page.goto(`/patient?branch=${target.code.toLowerCase()}`);
    await expect(page.locator(".app-header-branch-name")).toHaveText(target.name);
    await expect.poll(() => branchParam(page).get("branch")).toBe(target.code);
    expect(await workingBranchId(page)).toBe(target.id);

    // A code no branch has falls back rather than leaving the page empty.
    await page.goto("/patient?branch=NO-SUCH-BRANCH");
    await expect(page.locator(".app-header-branch-name")).toHaveText(target.name);
    await expect.poll(() => branchParam(page).get("branch")).toBe(target.code);

    // Tất cả chi nhánh has no code: the param goes.
    await page.locator(".app-header-branch").click();
    await page.locator(".app-popover-list").getByText("Tất cả chi nhánh").click();
    await expect.poll(() => branchParam(page).has("branch")).toBe(false);
  } finally {
    // Leaves the header on the seeded branch for the specs that follow.
    await page.goto(`/patient?branchId=${BRANCH_ONE}`);
    await deleteBranches(page, [target]);
  }
});
