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
    await expect(page.locator(".bd-group-name", { hasText: category })).toBeVisible();

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
  });

  test("an article needs a category to be filed under", async ({ page }) => {
    await page.goto("/operations/finance");
    // Nothing selected, so the reference disables this — and so does this.
    await expect(page.getByRole("button", { name: /Tạo Bài Viết$/ })).toBeDisabled();
  });

  test("a new category goes to the top of the panel", async ({ page }) => {
    const id = runId();

    await page.goto("/operations/marketing");
    for (const name of [`CU ${id}`, `MOI ${id}`]) {
      await page.getByRole("button", { name: /Thêm Mới$/ }).click();
      const dialog = page.getByRole("dialog");
      await dialog.getByLabel(/Tên mục/).fill(name);
      await dialog.getByRole("button", { name: /Lưu$/ }).click();
      await expect(dialog).toBeHidden();
    }

    // Newest first, as the catalog panel does it.
    const names = page.locator(".bd-group-name");
    await expect(names.first()).toHaveText(`MOI ${id}`);
    await expect(names.nth(1)).toHaveText(`CU ${id}`);
  });

  test("both category commands are on the row itself", async ({ page }) => {
    const id = runId();
    const name = `HANG ${id}`;

    await page.goto("/operations/security");
    await page.getByRole("button", { name: /Thêm Mới$/ }).click();
    let dialog = page.getByRole("dialog");
    await dialog.getByLabel(/Tên mục/).fill(name);
    await dialog.getByRole("button", { name: /Lưu$/ }).click();
    await expect(dialog).toBeHidden();

    // No menu to open first: edit and delete sit on the row.
    await page.getByRole("button", { name: `Chỉnh sửa ${name}` }).click();
    dialog = page.getByRole("dialog");
    await dialog.getByLabel(/Tên mục/).fill(`${name} SUA`);
    await dialog.getByRole("button", { name: /Lưu$/ }).click();
    await expect(dialog).toBeHidden();
    await expect(page.locator(".bd-group-name", { hasText: `${name} SUA` })).toBeVisible();

    await page.getByRole("button", { name: `Xoá ${name} SUA` }).click();
    await page.getByRole("dialog").getByRole("button", { name: /Xoá$/ }).click();
    await expect(page.locator(".bd-group-name", { hasText: `${name} SUA` })).toHaveCount(0);
  });

  test("the article search is trimmed and ignores case", async ({ page }) => {
    const id = runId();
    const title = `TIM KIEM ${id}`;

    await page.goto("/operations/treatment");
    await page.getByRole("button", { name: /Thêm Mới$/ }).click();
    let dialog = page.getByRole("dialog");
    await dialog.getByLabel(/Tên mục/).fill(`MUC TK ${id}`);
    await dialog.getByRole("button", { name: /Lưu$/ }).click();
    await expect(dialog).toBeHidden();

    await page.getByRole("button", { name: /Tạo Bài Viết$/ }).click();
    dialog = page.getByRole("dialog");
    await dialog.getByLabel(/Tiêu đề/).fill(title);
    await dialog.getByRole("button", { name: /Lưu$/ }).click();
    await expect(dialog).toBeHidden();

    const search = page.getByLabel("Tìm kiếm");
    const row = page.getByRole("row", { name: new RegExp(title) });

    for (const term of [title.toLowerCase(), `   ${title}   `, `${id} tim`]) {
      await search.fill(term);
      await expect(row).toBeVisible();
    }

    // Whitespace alone is not a search.
    await search.fill("   ");
    await expect(row).toBeVisible();
  });

  test("an image in an article is stored beside it, not inside it", async ({ page }) => {
    const id = runId();
    const title = `ANH ${id}`;

    await page.goto("/operations/finance");
    await page.getByRole("button", { name: /Thêm Mới$/ }).click();
    let dialog = page.getByRole("dialog");
    await dialog.getByLabel(/Tên mục/).fill(`MUC ANH ${id}`);
    await dialog.getByRole("button", { name: /Lưu$/ }).click();
    await expect(dialog).toBeHidden();

    await page.getByRole("button", { name: /Tạo Bài Viết$/ }).click();
    dialog = page.getByRole("dialog");
    await dialog.getByLabel(/Tiêu đề/).fill(title);

    // A real PNG, through the editor's own image button.
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64",
    );
    const chooser = page.waitForEvent("filechooser");
    await dialog.locator("button.ql-image").click();
    await (await chooser).setFiles({ name: "anh.png", mimeType: "image/png", buffer: png });

    // The body links to the image rather than carrying its bytes.
    const img = dialog.locator(".ql-editor img");
    await expect(img).toBeVisible();
    await expect(img).toHaveAttribute("src", /\/api\/v1\/app\/operations\/article-images\//);

    // Nothing of the file itself left in the body: a data: URL would put the
    // bytes in the row, which is the thing this replaced.
    await expect(dialog.locator('.ql-editor img[src^="data:"]')).toHaveCount(0);

    await dialog.getByRole("button", { name: /Lưu$/ }).click();
    await expect(dialog).toBeHidden();

    // It saved — this is what used to fail — and it comes back.
    await page.reload();
    await page.getByRole("button", { name: `Chỉnh sửa ${title}` }).click();
    dialog = page.getByRole("dialog");
    await expect(dialog.locator(".ql-editor img")).toBeVisible();
  });
});
