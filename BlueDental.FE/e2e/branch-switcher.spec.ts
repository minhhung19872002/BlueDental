import { expect, test } from "@playwright/test";
import { BRANCH2_USER, MANAGER_USER, login, runId } from "./fixtures/auth";

/**
 * Feature: the header's branch switcher, and the rule that every screen reads
 * and writes the branch it is pointed at.
 *
 * Real stack only: real login, real ASP.NET Core API, real PostgreSQL.
 */
test.describe("Chi nhánh", () => {
  test("offers only the branches the account may work in", async ({ page }) => {
    await login(page);
    await page.goto("/taxonomy/service");

    await page.locator(".app-header-branch").click();

    const menu = page.getByRole("dialog");
    await expect(menu.getByText("Tất cả chi nhánh")).toBeVisible();
    await expect(menu.getByText("BlueDental - Chi nhánh chính")).toBeVisible();

    // admin is assigned to the first branch only, so the second must not be on
    // offer — picking it would 403 on every request.
    await expect(menu.getByText("BlueDental - Chi nhánh 2")).toHaveCount(0);
  });

  test("a clinic-wide account switches branches and each one shows its own catalog", async ({
    page,
  }) => {
    await login(page, MANAGER_USER);
    await page.goto("/taxonomy/service");

    const menu = page.getByRole("dialog");

    /** Reopening only works once the previous popover has finished closing. */
    const pickBranch = async (name: string) => {
      await page.locator(".app-header-branch").click();
      await expect(menu).toBeVisible();
      await menu.getByText(name).click();
      await expect(menu).toBeHidden();
      await expect(page.locator(".app-header-branch-name")).toHaveText(name);
    };

    // No branch assignment means no branch restriction, so both are on offer.
    await page.locator(".app-header-branch").click();
    await expect(menu.getByText("BlueDental - Chi nhánh chính")).toBeVisible();
    await expect(menu.getByText("BlueDental - Chi nhánh 2")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();

    await pickBranch("BlueDental - Chi nhánh chính");
    await expect(page.getByRole("button", { name: "Nhóm Implant", exact: true })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Nhóm Nha Khoa Trẻ Em", exact: true }),
    ).toHaveCount(0);

    // Switching branch swaps the whole catalog, seeded groups included.
    await pickBranch("BlueDental - Chi nhánh 2");
    await expect(
      page.getByRole("button", { name: "Nhóm Nha Khoa Trẻ Em", exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Nhóm Implant", exact: true })).toHaveCount(0);

    // And it survives a reload, because the choice is persisted.
    await page.reload();
    await expect(page.locator(".app-header-branch-name")).toHaveText("BlueDental - Chi nhánh 2");
    await expect(
      page.getByRole("button", { name: "Nhóm Nha Khoa Trẻ Em", exact: true }),
    ).toBeVisible();
  });

  test("a branch-scoped account sees and writes only its own catalog", async ({ page }) => {
    const groupName = `NHÓM CN2 ${runId()}`;

    await login(page, BRANCH2_USER);
    await page.goto("/taxonomy/service");

    await expect(page.locator(".app-header-branch-name")).toHaveText("BlueDental - Chi nhánh 2");

    // The first branch owns a group called Implant; this account must not see
    // it, whatever its own catalog happens to hold.
    await expect(page.getByRole("button", { name: /^Implant$/ })).toHaveCount(0);

    await page.getByRole("button", { name: "Thêm nhóm phân loại" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel(/Tên phân loại/).fill(groupName);
    await dialog.getByRole("button", { name: "Lưu", exact: true }).click();

    await expect(page.getByRole("heading", { name: groupName })).toBeVisible();

    // Written into this branch, so it survives a reload for this account…
    await page.reload();
    await expect(page.getByRole("button", { name: groupName, exact: true })).toBeVisible();

    // …and is invisible to the other branch's account.
    await page.goto("/login");
    await page.evaluate(() => localStorage.clear());
    await login(page);
    await page.goto("/taxonomy/service");

    await expect(page.locator(".app-header-branch-name")).toHaveText(
      "BlueDental - Chi nhánh chính",
    );
    await expect(page.getByRole("button", { name: groupName, exact: true })).toHaveCount(0);
  });
});
