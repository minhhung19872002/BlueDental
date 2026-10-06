import { expect, test } from "@playwright/test";
import { assertRealApiTraffic, login, runId } from "./fixtures/auth";

/**
 * Bug #20 — Cài đặt > Danh sách chi nhánh: a freshly created branch showed
 * "—" under Lần cập nhật cuối, the table had no Mã chi nhánh column, and the
 * ID column printed the raw GUID.
 *
 * Real stack: the branch is created through the Thêm chi nhánh dialog, the
 * list is re-read after a reload, and the branch is deleted again at the end.
 */

test("branch list shows code, a sequential ID and a created time for a new branch", async ({ page }) => {
  const suffix = runId();
  const code = `E2EBR${suffix}`;
  const name = `E2E chi nhánh ${suffix}`;

  await login(page);
  await Promise.all([
    assertRealApiTraffic(page, "/v1/app/clinic-branches"),
    page.goto("/settings?tab=branches"),
  ]);

  await page.getByRole("button", { name: "Thêm chi nhánh" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Mã chi nhánh").fill(code);
  await dialog.getByLabel("Tên chi nhánh").fill(name);
  await dialog.getByRole("button", { name: "Lưu" }).click();
  await expect(page.getByText("Tạo chi nhánh thành công")).toBeVisible();

  await Promise.all([
    assertRealApiTraffic(page, "/v1/app/clinic-branches"),
    page.reload(),
  ]);
  const table = page.locator(".ant-table");
  await expect(table.getByRole("columnheader", { name: "Mã chi nhánh" })).toBeVisible();

  // Oldest first, so the new branch sits on the last page.
  const pages = page.locator(".ant-pagination-item");
  if ((await pages.count()) > 1) await pages.last().click();

  const ids = (await table.locator("tbody tr.ant-table-row td:first-child").allInnerTexts()).map((s) => Number(s.trim()));
  expect(ids.every(Number.isInteger)).toBe(true);
  expect(ids).toEqual(ids.map((_, i) => ids[0] + i));

  const row = table.locator("tbody tr.ant-table-row").filter({ hasText: name });
  const cells = row.locator("td");
  await expect(cells.nth(0)).toHaveText(String(ids[ids.length - 1]));
  await expect(cells.nth(1)).toHaveText(code);
  // Never edited → falls back to its creation time instead of "—".
  await expect(cells.nth(5)).toHaveText(/\d{2}\/\d{2}\/\d{4}/);

  await row.locator("button.ant-btn-dangerous").click();
  await page.getByRole("dialog").getByRole("button", { name: "Xoá" }).click();
  await expect(row.locator("button.ant-btn-dangerous")).toHaveCount(0);
});
