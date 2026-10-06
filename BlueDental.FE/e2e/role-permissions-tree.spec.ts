import { expect, test } from "@playwright/test";
import { assertRealApiTraffic, login } from "./fixtures/auth";

/**
 * R-747 (QA dòng 10) — "Lịch hẹn" was listed under both Điều trị and Lịch hẹn,
 * so one tick showed up in two groups and the counter read 14/378 for 9
 * distinct permissions. Each permission now sits in exactly one group.
 *
 * Read-only on the real stack: nothing is saved.
 */

interface TreeNode {
  type: "group" | "leaf";
  id: string;
  children?: TreeNode[];
}

function leafIds(nodes: TreeNode[]): string[] {
  return nodes.flatMap((n) => (n.type === "leaf" ? [n.id] : leafIds(n.children ?? [])));
}

test("each permission is listed once and counted once", async ({ page }) => {
  await login(page);
  const treeResponse = page.waitForResponse((res) => res.url().includes("/role-permission/permission-tree"));
  await Promise.all([
    assertRealApiTraffic(page, "/api/v1/app/role-permission"),
    page.goto("/settings?tab=permission"),
  ]);
  const { tree } = (await (await treeResponse).json()) as { tree: TreeNode[] };
  const ids = leafIds(tree);
  const duplicates = ids.filter((id, i) => ids.indexOf(id) !== i);
  expect(duplicates).toEqual([]);

  await page.locator(".perm-role-item").filter({ hasText: /^dentist/ }).click();
  await expect(page.locator(".perm-editor-subtitle")).toContainText(`/${ids.length} `);

  // The tester's search: one Lịch hẹn group, the customer calendar one.
  await page.getByPlaceholder("Tìm quyền...").fill("appointment.read");
  await expect(page.locator(".perm-leaf")).toHaveCount(1);
  await expect(page.locator(".perm-group-label", { hasText: "Lịch hẹn khách hàng" })).toHaveCount(1);
  await expect(page.locator(".perm-group-label", { hasText: "Điều trị" })).toHaveCount(0);
});

test("the search matches group names as displayed, like staging", async ({ page }) => {
  await login(page);
  await Promise.all([
    assertRealApiTraffic(page, "/api/v1/app/role-permission"),
    page.goto("/settings?tab=permission"),
  ]);
  await page.locator(".perm-role-item").filter({ hasText: /^dentist/ }).click();
  const search = page.getByPlaceholder("Tìm quyền...");

  // Group labels are i18n keys underneath; the search reads the Vietnamese text.
  await search.fill("Lịch hẹn");
  await expect(page.locator(".perm-group-label", { hasText: /^Lịch hẹn$/ })).toHaveCount(1);
  await expect(page.locator(".perm-group-label", { hasText: "Lịch hẹn khách hàng" })).toHaveCount(1);

  await search.fill("  danh mục  ");
  await expect(page.locator(".perm-group-label", { hasText: /^Danh mục$/ }).first()).toBeVisible();

  await search.fill("BE:Perm");
  await expect(page.locator(".perm-group-label")).toHaveCount(0);
});
