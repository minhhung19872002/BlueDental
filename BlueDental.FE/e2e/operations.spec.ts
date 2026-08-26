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
    await dialog.getByLabel(/Tên phân loại/).fill(category);
    await dialog.getByRole("button", { name: /Lưu$/ }).click();
    await expect(dialog).toBeHidden();
    await expect(page.locator(".bd-ops-cat-name", { hasText: category })).toBeVisible();

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
    await expect(page.getByText("Hiển thị 1–1 trên 1")).toBeVisible();
  });

  test("every division is its own URL, and the sub-tab travels in the query", async ({ page }) => {
    await page.goto("/operations");

    await page.getByRole("link", { name: "Khối lễ tân" }).click();
    await expect(page).toHaveURL(/\/operations\/reception/);

    await page.getByRole("tab", { name: "Quy trình" }).click();
    await expect(page).toHaveURL(/receptionSubTab=process/);

    // Straight to a sub-screen by its address.
    await page.goto("/operations/cskh?cskhSubTab=task");
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
      await dialog.getByLabel(/Tên phân loại/).fill(name);
      await dialog.getByRole("button", { name: /Lưu$/ }).click();
      await expect(dialog).toBeHidden();
    }

    // Newest first, as the catalog panel does it.
    const names = page.locator(".bd-ops-cat-name");
    await expect(names.first()).toHaveText(`MOI ${id}`);
    await expect(names.nth(1)).toHaveText(`CU ${id}`);
  });

  test("both category commands are on the row itself", async ({ page }) => {
    const id = runId();
    const name = `HANG ${id}`;

    await page.goto("/operations/security");
    await page.getByRole("button", { name: /Thêm Mới$/ }).click();
    let dialog = page.getByRole("dialog");
    await dialog.getByLabel(/Tên phân loại/).fill(name);
    await dialog.getByRole("button", { name: /Lưu$/ }).click();
    await expect(dialog).toBeHidden();

    // No menu to open first: edit and delete sit on the row.
    await page.getByRole("button", { name: `Chỉnh sửa ${name}` }).click();
    dialog = page.getByRole("dialog");
    await dialog.getByLabel(/Tên phân loại/).fill(`${name} SUA`);
    await dialog.getByRole("button", { name: /Lưu$/ }).click();
    await expect(dialog).toBeHidden();
    await expect(page.locator(".bd-ops-cat-name", { hasText: `${name} SUA` })).toBeVisible();

    await page.getByRole("button", { name: `Xoá ${name} SUA` }).click();
    await page.getByRole("dialog").getByRole("button", { name: /Xoá$/ }).click();
    await expect(page.locator(".bd-ops-cat-name", { hasText: `${name} SUA` })).toHaveCount(0);
  });

  test("the article search is trimmed and ignores case", async ({ page }) => {
    const id = runId();
    const title = `TIM KIEM ${id}`;

    await page.goto("/operations/treatment");
    await page.getByRole("button", { name: /Thêm Mới$/ }).click();
    let dialog = page.getByRole("dialog");
    await dialog.getByLabel(/Tên phân loại/).fill(`MUC TK ${id}`);
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

  test("each division offers the sub-tabs the reference gives it", async ({ page }) => {
    const subTabs = async () => {
      // Read only once the row has rendered, or an empty list passes for a
      // division that simply had not loaded yet.
      await expect(page.getByRole("tab", { name: "Trang chủ" })).toBeVisible();
      return page
        .getByRole("tab")
        .filter({ hasNotText: /^(Tổng quan|Truy cập)$/ })
        .allInnerTexts();
    };

    await page.goto("/operations/overview");
    expect(await subTabs()).toEqual([
      "Trang chủ",
      "Quy trình",
      "Công việc",
      "Báo cáo",
      "Chẩn đoán chưa điều trị",
      "Đơn thuốc",
    ]);

    // Not every division gets all six: Khối bảo vệ has three.
    await page.goto("/operations/security");
    expect(await subTabs()).toEqual(["Trang chủ", "Quy trình", "Công việc"]);

    // And Khối tài chính has its own six, not the shared set.
    await page.goto("/operations/finance");
    expect(await subTabs()).toEqual([
      "Trang chủ",
      "Khách hàng phát sinh",
      "Quy trình",
      "Công việc",
      "Hóa đơn",
      "Hoàn thành theo dịch vụ",
    ]);
  });

  test("every division keeps its own sub-tab, and they all travel together", async ({ page }) => {
    await page.goto("/operations/overview");
    await page.getByRole("tab", { name: "Công việc" }).click();
    await expect(page).toHaveURL(/overviewSubTab=task/);

    await page.getByRole("link", { name: "Khối lễ tân" }).click();
    await page.getByRole("tab", { name: "Quy trình" }).click();
    await expect(page).toHaveURL(/receptionSubTab=process/);
    // The one left behind is still in the address, as the reference carries it.
    await expect(page).toHaveURL(/overviewSubTab=task/);

    // So going back lands on the sub-tab this division was left on.
    await page.getByRole("link", { name: "Quản trị vận hành" }).click();
    await expect(page.getByRole("tab", { name: "Công việc" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  test("only Trang chủ, Quy trình and Công việc are the article screen", async ({ page }) => {
    await page.goto("/operations/overview");
    await expect(page.getByRole("button", { name: /Tạo Bài Viết$/ })).toBeVisible();

    // Báo cáo is a report of its own, with no categories and no articles.
    await page.getByRole("tab", { name: "Báo cáo" }).click();
    await expect(page.getByRole("button", { name: /Tạo Bài Viết$/ })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Thêm Mới$/ })).toHaveCount(0);

    // Khối điều trị puts Truy cập in a row of its own above the sub-tabs.
    await page.goto("/operations/treatment");
    await expect(page.getByRole("tab", { name: "Tổng quan" })).toBeVisible();
    await page.getByRole("tab", { name: "Truy cập" }).click();
    await expect(page).toHaveURL(/treatmentTab=access/);
    await expect(page.getByRole("button", { name: /Tạo Bài Viết$/ })).toHaveCount(0);
  });

  test("deleting a category takes its articles with it", async ({ page }) => {
    const id = runId();
    const category = `MUC XOA ${id}`;
    const title = `BAI VIET XOA ${id}`;

    await page.goto("/operations/cskh");

    await page.getByRole("button", { name: /Thêm Mới$/ }).click();
    let dialog = page.getByRole("dialog");
    await dialog.getByLabel(/Tên phân loại/).fill(category);
    await dialog.getByRole("button", { name: /Lưu$/ }).click();
    await expect(dialog).toBeHidden();

    await page.getByRole("button", { name: /Tạo Bài Viết$/ }).click();
    dialog = page.getByRole("dialog");
    await dialog.getByLabel(/Tiêu đề/).fill(title);
    await dialog.getByRole("button", { name: /Lưu$/ }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole("row", { name: new RegExp(title) })).toBeVisible();

    await page.getByRole("button", { name: `Xoá ${category}` }).click();
    await page.getByRole("dialog").getByRole("button", { name: /Xoá$/ }).click();
    await expect(page.locator(".bd-ops-cat-name", { hasText: category })).toHaveCount(0);

    // The article was reachable only through that category, so it has to be
    // gone from the server too — not merely hidden by the cleared selection.
    await page.reload();
    await expect(page.getByRole("row", { name: new RegExp(title) })).toHaveCount(0);
  });

  test("an image in an article is stored beside it, not inside it", async ({ page }) => {
    const id = runId();
    const title = `ANH ${id}`;

    await page.goto("/operations/finance");
    await page.getByRole("button", { name: /Thêm Mới$/ }).click();
    let dialog = page.getByRole("dialog");
    await dialog.getByLabel(/Tên phân loại/).fill(`MUC ANH ${id}`);
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
    await expect(img).toHaveAttribute("src", /\/api\/v1\/app\/rich-text-images\//);

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

  test("the panel's Thêm Mới button carries no lift", async ({ page }) => {
    await page.goto("/operations/overview");

    const button = page.locator(".bd-ops-panel-head .ant-btn");
    await expect(button).toBeVisible();

    // Ant Design shadows every solid button; against the list below it that
    // reads as a seam, so this one is flat.
    expect(await button.evaluate((el) => getComputedStyle(el).boxShadow)).toBe("none");
  });

  test("a pinned column keeps its heading while the rows scroll under it", async ({ page }) => {
    await page.setViewportSize({ width: 1500, height: 560 });
    await page.goto("/operations/overview");
    await expect(page.locator("tbody tr.ant-table-row").first()).toBeVisible();

    const body = page.locator(".bd-cat-card .ant-table-content");
    const pinnedHeading = page.locator(".bd-cat-card thead th.ant-table-cell-fix-end");
    await expect(pinnedHeading).toHaveText("Thao tác");

    await body.evaluate((el) => {
      el.scrollTop = 250;
    });

    // Ant Design gives the pinned header and the pinned rows the same z-index,
    // and a tie goes to whichever comes later — so the rows used to scroll
    // straight over this heading. Whatever is painted here must be the heading.
    const painted = await pinnedHeading.evaluate((th) => {
      const r = th.getBoundingClientRect();
      const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return top === th || th.contains(top);
    });
    expect(painted).toBe(true);
    await expect(pinnedHeading).toBeVisible();
  });

  test("a phone-width window scrolls the page instead of collapsing the panes", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 430, height: 780 });
    await page.goto("/operations/overview");
    await expect(page.locator("tbody tr.ant-table-row").first()).toBeVisible();

    // The page scrolls — every box used to be exactly as tall as its parent, so
    // there was nowhere to scroll to.
    expect(
      await page.evaluate(
        () => document.documentElement.scrollHeight > window.innerHeight + 2,
      ),
    ).toBe(true);

    // The category column is gone; it is reached through a drawer here, the
    // way Danh mục does it at this width.
    await expect(page.locator(".bd-ops-aside")).toBeHidden();
    await page.locator(".bd-ops-main").getByRole("button", { name: "Chọn nhóm" }).click();

    const drawer = page.getByRole("dialog", { name: "Phân loại" });
    await expect(drawer).toBeVisible();
    await expect(drawer.getByRole("button", { name: /Thêm Mới$/ })).toBeVisible();

    // The panel fills the drawer rather than stopping partway down it.
    const filled = await drawer.evaluate((el) => {
      const body = el.querySelector(".ant-drawer-body")!;
      const panel = el.querySelector(".bd-ops-panel")!;
      return Math.abs(panel.clientHeight - body.clientHeight) < 4;
    });
    expect(filled).toBe(true);

    // The tools sit below the bar's rule with the same air Danh mục leaves
    // under its own, rather than hard against it.
    const belowRule = await page.evaluate(() => {
      const bar = document.querySelector(".bd-ops-main > .bd-cat-header--bar")!;
      const tool = document.querySelector(".bd-ops-toolbar .ant-btn")!;
      return Math.round(tool.getBoundingClientRect().y - bar.getBoundingClientRect().bottom);
    });
    expect(belowRule).toBe(16);

    // Picking a category closes the drawer and filters behind it.
    await drawer.locator(".bd-ops-cat-name").first().click();
    await expect(drawer).toBeHidden();

    // The table is a workable height — neither the few pixels it collapsed to
    // nor the 1262px it ran to when left unbounded.
    const card = (await page.locator(".bd-cat-card").boundingBox())!;
    expect(card.height).toBeGreaterThan(300);
    expect(card.height).toBeLessThan(700);
  });
});
