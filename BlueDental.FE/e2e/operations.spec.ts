import { expect, test } from "@playwright/test";
import { login, runId } from "./fixtures/auth";

/**
 * Feature: Quản trị vận hành.
 *
 * The operations page manages articles (blog posts / announcements) grouped
 * by category. Tests verify CRUD through the real API and PostgreSQL.
 */
test.describe("Quản trị vận hành", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("an article is created with a category and persists after reload", async ({ page }) => {
    const id = runId();
    const categoryName = `Mục E2E ${id}`;
    const title = `Thông báo E2E ${id}`;

    await page.goto("/operations");
    await page.waitForLoadState("networkidle");

    // First, create a category (required before articles can be created).
    await page.getByRole("button", { name: "Thêm Mới" }).click();
    const categoryDialog = page.getByRole("dialog");
    await categoryDialog.getByPlaceholder("Tên mục").fill(categoryName);
    await categoryDialog.getByRole("button", { name: "Đồng ý" }).click();
    await expect(categoryDialog).toBeHidden({ timeout: 10_000 });

    // Wait for the category to appear in the sidebar.
    await expect(page.getByText(categoryName)).toBeVisible();

    // Select the new category.
    await page.getByText(categoryName).click();

    // Now create an article in that category.
    await page.getByRole("button", { name: "Tạo Bài Viết" }).click();
    const articleDialog = page.getByRole("dialog");
    await articleDialog.getByPlaceholder("Tiêu đề bài viết").fill(title);
    await articleDialog.getByRole("button", { name: "Đồng ý" }).click();
    await expect(articleDialog).toBeHidden({ timeout: 10_000 });

    const row = page.getByRole("row", { name: new RegExp(title) });
    await expect(row).toBeVisible();

    await page.reload();
    await expect(page.getByRole("row", { name: new RegExp(title) })).toBeVisible();
  });

  test("the operations page loads and displays the create button", async ({ page }) => {
    await page.goto("/operations");
    await page.waitForLoadState("networkidle");

    await expect(page.locator("body")).not.toContainText("Unexpected Application Error");
    await expect(page.getByRole("button", { name: "Tạo Bài Viết" })).toBeVisible();
  });

  test("the operations page loads categories correctly", async ({ page }) => {
    await page.goto("/operations");

    const requests: string[] = [];
    page.on("request", (req) => {
      if (req.url().includes("/operations/")) requests.push(req.url());
    });

    await page.waitForLoadState("networkidle");

    expect(requests.length).toBeGreaterThan(0);
  });
});
