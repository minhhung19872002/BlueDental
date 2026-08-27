import { expect, test } from "@playwright/test";
import { BRANCH2_USER, MANAGER_USER, login, runId } from "./fixtures/auth";

/**
 * Feature: the header's branch switcher, and the rule that every screen reads
 * and writes the branch it is pointed at.
 *
 * Seeded branch names (BlueDentalDataSeedContributor / BranchSeedContributor):
 * the first branch's name is a strict prefix of the second's, so every text
 * match in here must be exact or it hits both entries.
 *
 * Real stack only: real login, real ASP.NET Core API, real PostgreSQL.
 */
const MAIN_BRANCH = "Nha Khoa Đức Hạnh Premium";
const SECOND_BRANCH = "Nha Khoa Đức Hạnh Premium - Chi nhánh 2";

test.describe("Chi nhánh", () => {
  test("offers only the branches the account may work in", async ({ page }) => {
    // admin is clinic-wide since the seeder stopped assigning it a branch, so
    // the restricted menu has to be proven with the branch-scoped account.
    await login(page, BRANCH2_USER);
    await page.goto("/taxonomy/service");

    await page.locator(".app-header-branch").click();

    const menu = page.locator(".app-popover-list");
    await expect(menu.getByText("Tất cả chi nhánh")).toBeVisible();
    await expect(menu.getByText(SECOND_BRANCH, { exact: true })).toBeVisible();

    // branch2 is assigned to the second branch only, so the first must not be
    // on offer — picking it would 403 on every request.
    await expect(menu.getByText(MAIN_BRANCH, { exact: true })).toHaveCount(0);
  });

  test("a clinic-wide account switches branches and each one shows its own catalog", async ({
    page,
  }) => {
    await login(page, MANAGER_USER);
    await page.goto("/taxonomy/service");

    const menu = page.locator(".app-popover-list");

    /** Reopening only works once the previous popover has finished closing. */
    const pickBranch = async (name: string) => {
      await page.locator(".app-header-branch").click();
      await expect(menu).toBeVisible();
      await menu.getByText(name, { exact: true }).click();
      await expect(menu).toBeHidden();
      await expect(page.locator(".app-header-branch-name")).toHaveText(name);
    };

    // No branch assignment means no branch restriction, so both are on offer.
    await page.locator(".app-header-branch").click();
    await expect(menu.getByText(MAIN_BRANCH, { exact: true })).toBeVisible();
    await expect(menu.getByText(SECOND_BRANCH, { exact: true })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();

    /**
     * Asks the server for the group by name rather than scanning the panel: the
     * panel loads a bounded page of groups, so a seeded group can sit past the
     * end of it once a branch holds enough of them.
     */
    const searchGroups = async (keyword: string) => {
      const search = page.getByLabel("Tìm nhóm...");
      await search.fill(keyword);
      await expect(page.getByRole("button", { name: new RegExp(keyword) }).first()).toBeVisible();
    };

    await pickBranch(MAIN_BRANCH);
    await searchGroups("Implant");
    await expect(page.getByRole("button", { name: "Nhóm Implant", exact: true })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Nhóm Nha Khoa Trẻ Em", exact: true }),
    ).toHaveCount(0);

    // Switching branch swaps the whole catalog, seeded groups included.
    await pickBranch(SECOND_BRANCH);
    await searchGroups("Nha Khoa Trẻ Em");
    await expect(
      page.getByRole("button", { name: "Nhóm Nha Khoa Trẻ Em", exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Nhóm Implant", exact: true })).toHaveCount(0);

    // And it survives a reload, because the choice is persisted.
    await page.reload();
    await expect(page.locator(".app-header-branch-name")).toHaveText(SECOND_BRANCH);
    await expect(
      page.getByRole("button", { name: "Nhóm Nha Khoa Trẻ Em", exact: true }),
    ).toBeVisible();
  });

  test("a branch-scoped account sees and writes only its own catalog", async ({ page }) => {
    const groupName = `NHÓM CN2 ${runId()}`;

    await login(page, BRANCH2_USER);
    await page.goto("/taxonomy/service");

    await expect(page.locator(".app-header-branch-name")).toHaveText(SECOND_BRANCH);

    // The first branch owns a group called Implant; this account must not see
    // it, whatever its own catalog happens to hold.
    await expect(page.getByRole("button", { name: /^Implant$/ })).toHaveCount(0);

    await page.getByRole("button", { name: "Thêm nhóm phân loại" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel(/Tên phân loại/).fill(groupName);
    await dialog.getByRole("button", { name: /Lưu$/ }).click();

    await expect(page.getByRole("heading", { name: groupName })).toBeVisible();

    // Written into this branch, so it survives a reload for this account…
    await page.reload();
    await expect(page.getByRole("button", { name: groupName, exact: true })).toBeVisible();

    // …and stays out of sight on the first branch, which is where admin's
    // header points by default (its home branch, even though it is clinic-wide).
    await page.goto("/login");
    await page.evaluate(() => localStorage.clear());
    await login(page);
    await page.goto("/taxonomy/service");

    await expect(page.locator(".app-header-branch-name")).toHaveText(MAIN_BRANCH);
    await expect(page.getByRole("button", { name: groupName, exact: true })).toHaveCount(0);
  });
});
