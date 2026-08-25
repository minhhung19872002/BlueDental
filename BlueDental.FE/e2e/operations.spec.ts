import { expect, test } from "@playwright/test";
import { login, runId } from "./fixtures/auth";

/**
 * Feature: Vận hành — a screen per division, categories on the left and the
 * articles filed under the selected one on the right.
 *
 * Real stack only: real login, real ASP.NET Core API, real PostgreSQL.
 */
test.describe("Vận hành", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("files an article under a category, and both survive a reload", async ({ page }) => {
    const id = runId();
    const category = `MUC ${id}`;
    const title = `BAI VIET ${id}`;

    await page.goto("/operations");

    // ── Category ───────────────────────────────────────────────────────────
    await page.getByRole("button", { name: /Thêm Mới$/ }).click();
    let dialog = page.getByRole("dialog");
    await dialog.getByLabel(/Tên mục/).fill(category);
    await dialog.getByRole("button", { name: /Lưu$/ }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole("button", { name: new RegExp(category) })).toBeVisible();

    // ── Article ────────────────────────────────────────────────────────────
    const create = page.getByRole("button", { name: /Tạo Bài Viết$/ });
    await expect(create).toBeEnabled();
    await create.click();

    dialog = page.getByRole("dialog");
    await dialog.getByLabel(/Tiêu đề/).fill(title);
    await dialog.locator(".ql-editor").fill("Nội dung quy trình");
    await dialog.getByRole("button", { name: /Lưu$/ }).click();
    await expect(dialog).toBeHidden();

    const row = page.getByRole("row", { name: new RegExp(title) });
    await expect(row).toBeVisible();

    // The server kept it, not the page.
    await page.reload();
    await expect(page.getByRole("row", { name: new RegExp(title) })).toBeVisible();
    // The count beside the heading, and the pager's own summary.
    await expect(page.locator(".bd-cat-count")).toHaveText("1 bài viết");
    await expect(page.getByText("Hiển thị 1–1 trên 1 bài viết")).toBeVisible();
  });

  test("every division is its own URL, and the sub-tab travels in the query", async ({ page }) => {
    await page.goto("/operations");

    await page.getByRole("link", { name: "Khối lễ tân" }).click();
    await expect(page).toHaveURL(/\/operations\/reception/);

    await page.getByRole("tab", { name: "Quy trình" }).click();
    await expect(page).toHaveURL(/subTab=process/);

    // Straight to a sub-screen by its address.
    await page.goto("/operations/cskh?subTab=task");
    await expect(page.getByRole("tab", { name: "Công việc" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(page.getByRole("heading", { name: "Công việc" })).toBeVisible();
  });

  test("an article needs a category to be filed under", async ({ page }) => {
    await page.goto("/operations/finance");
    // Nothing selected, so the reference disables this — and so does this.
    await expect(page.getByRole("button", { name: /Tạo Bài Viết$/ })).toBeDisabled();
  });
});
