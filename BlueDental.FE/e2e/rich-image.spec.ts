import { expect, test } from "@playwright/test";
import { login, runId } from "./fixtures/auth";

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

test.describe("Rich text images", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("Danh mục stores its picture rather than embedding it", async ({ page }) => {
    await page.goto("/taxonomy/consulting");

    // A group has to be chosen before an entry can be added to it.
    await page.locator(".bd-group-name").first().click();

    await page.getByRole("button", { name: "Thêm dữ liệu tư vấn" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.locator(".ql-editor")).toBeVisible();

    const chooser = page.waitForEvent("filechooser");
    await dialog.locator("button.ql-image").click();
    await (await chooser).setFiles({ name: "a.png", mimeType: "image/png", buffer: PNG });

    // It settles on a stored link, the same as Vận hành — this editor used to
    // keep the bytes in the row as base64.
    const stored = dialog.locator('.ql-editor img[src*="/rich-text-images/"]');
    await expect(stored).toBeVisible();
    await expect(dialog.locator('.ql-editor img[src^="data:"]')).toHaveCount(0);

    // Settled, so nothing is dimmed as though still in flight.
    expect(await stored.evaluate((el) => getComputedStyle(el).opacity)).toBe("1");
  });

  test("Vận hành swaps to the stored picture without it vanishing", async ({ page }) => {
    const id = runId();

    await page.goto("/operations/security");
    await page.getByRole("button", { name: /Thêm Mới$/ }).click();
    let dialog = page.getByRole("dialog");
    await dialog.getByLabel(/Tên phân loại/).fill(`MUC IMG ${id}`);
    await dialog.getByRole("button", { name: /Lưu$/ }).click();
    await expect(dialog).toBeHidden();

    await page.getByRole("button", { name: /Tạo Bài Viết$/ }).click();
    dialog = page.getByRole("dialog");
    await dialog.getByLabel(/Tiêu đề/).fill(`ANH ${id}`);

    // Watch the editor for any moment where the picture is gone entirely.
    await page.evaluate(() => {
      (window as unknown as { __gaps: number }).__gaps = 0;
      const editor = document.querySelector(".ql-editor")!;
      const seen = { had: false };
      const tick = () => {
        const has = !!editor.querySelector("img");
        if (seen.had && !has) (window as unknown as { __gaps: number }).__gaps += 1;
        if (has) seen.had = true;
        requestAnimationFrame(tick);
      };
      tick();
    });

    const chooser = page.waitForEvent("filechooser");
    await dialog.locator("button.ql-image").click();
    await (await chooser).setFiles({ name: "b.png", mimeType: "image/png", buffer: PNG });

    // Settled on the stored URL.
    await expect(dialog.locator('.ql-editor img[src*="/rich-text-images/"]')).toBeVisible();

    // Never left the document along the way.
    expect(await page.evaluate(() => (window as unknown as { __gaps: number }).__gaps)).toBe(0);
  });
});
