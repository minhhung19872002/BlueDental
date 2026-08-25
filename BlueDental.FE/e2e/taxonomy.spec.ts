import { expect, test } from "@playwright/test";
import { assertRealApiTraffic, login, runId } from "./fixtures/auth";

/**
 * Feature: Danh mục (taxonomy + catalog entries).
 *
 * Real stack only: real login, real ASP.NET Core API, real PostgreSQL. No
 * page.route(), no fulfilled responses.
 *
 * The three sub-routes the reference draws as one flat table live in
 * taxonomy-flat.spec.ts.
 */
test.describe("Danh mục", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("creates a group and a priced service that survive a reload", async ({ page }) => {
    const id = runId();
    const groupName = `NHÓM E2E ${id}`;
    const serviceName = `Dịch vụ E2E ${id}`;

    await page.goto("/taxonomy/service");
    await assertRealApiTraffic(page, "/api/v1/app/taxonomies");

    // ── Group ──────────────────────────────────────────────────────────────
    await page.getByRole("button", { name: "Thêm nhóm phân loại" }).click();

    const groupDialog = page.getByRole("dialog");
    await groupDialog.getByLabel(/Tên phân loại/).fill(groupName);
    await groupDialog.getByRole("button", { name: /Lưu$/ }).click();

    // Creating a group selects it, so the table below is that group's own list.
    await expect(page.getByRole("heading", { name: groupName })).toBeVisible();

    // ── Entry ──────────────────────────────────────────────────────────────
    await page.getByRole("button", { name: /Thêm dịch vụ/ }).click();

    const entryDialog = page.getByRole("dialog");
    await entryDialog.getByLabel(/^Dịch vụ/).fill(serviceName);
    await entryDialog.getByLabel(/Mã dịch vụ/).fill(`E2E${id}`);
    await entryDialog.getByLabel(/^Giá$/).fill("180000");
    await entryDialog.getByRole("button", { name: /Lưu$/ }).click();

    const row = page.getByRole("row", { name: new RegExp(serviceName) });
    await expect(row).toBeVisible();
    await expect(row).toContainText("180.000 đ");
    await expect(row).toContainText(groupName);

    // ── Persistence ────────────────────────────────────────────────────────
    await page.reload();
    await expect(page.getByRole("row", { name: new RegExp(serviceName) })).toBeVisible();
  });

  test("gives every catalog its own URL", async ({ page }) => {
    await page.goto("/taxonomy/service");

    await page.getByRole("link", { name: "Loại thuốc" }).click();

    await expect(page).toHaveURL(/\/taxonomy\/medicine/);
    await assertRealApiTraffic(page, "group=medication_type");
    await expect(page.getByRole("link", { name: "Loại thuốc" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(page.getByRole("columnheader", { name: "Tên loại thuốc" })).toBeVisible();
  });

  test("drops the price column on catalogs that have no price", async ({ page }) => {
    await page.goto("/taxonomy/diagnosis");

    await expect(page.getByRole("columnheader", { name: "Tên chẩn đoán" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Giá", exact: true })).toHaveCount(0);
  });

  test("pages the entry list on the server", async ({ page }) => {
    await page.goto("/taxonomy/service");
    await assertRealApiTraffic(page, "skipCount=0");

    await expect(page.getByText(/Hiển thị .* bản ghi/)).toBeVisible();
  });

  test("reorders entries from the keyboard and keeps the new order", async ({ page }) => {
    const id = runId();
    const groupName = `NHÓM SORT ${id}`;

    await page.goto("/taxonomy/service");

    await page.getByRole("button", { name: "Thêm nhóm phân loại" }).click();
    const groupDialog = page.getByRole("dialog");
    await groupDialog.getByLabel(/Tên phân loại/).fill(groupName);
    await groupDialog.getByRole("button", { name: /Lưu$/ }).click();
    await expect(page.getByRole("heading", { name: groupName })).toBeVisible();

    for (const name of [`A ${id}`, `B ${id}`]) {
      await page.getByRole("button", { name: /Thêm dịch vụ/ }).click();
      const dialog = page.getByRole("dialog");
      await dialog.getByLabel(/^Dịch vụ/).fill(name);
      await dialog.getByRole("button", { name: /Lưu$/ }).click();
      await expect(dialog).toBeHidden();
      await expect(page.getByRole("row", { name: new RegExp(name) })).toBeVisible();
    }

    // Newest first, so the one added second is on top before anything is moved.
    const names = page.locator("tbody tr.ant-table-row td:nth-child(2) p");
    await expect(names).toHaveText([`B ${id}`, `A ${id}`]);

    // The grip is a real control: focus it and move the row with the keyboard.
    await page.locator("tbody tr.ant-table-row").nth(1).locator("td:first-child button").focus();
    await page.keyboard.press("ArrowUp");
    await expect(names).toHaveText([`A ${id}`, `B ${id}`]);

    // The order came from the server, not from local state — and the selected
    // group survives the reload because it lives in the URL.
    await page.reload();
    await expect(page.locator("tbody tr.ant-table-row td:nth-child(2) p")).toHaveText([`A ${id}`, `B ${id}`]);
  });

  test("drags a table row, and saves the whole order in one call", async ({ page }) => {
    const id = runId();
    const groupName = `NHÓM KEO ${id}`;

    await page.goto("/taxonomy/service");

    await page.getByRole("button", { name: "Thêm nhóm phân loại" }).click();
    const groupDialog = page.getByRole("dialog");
    await groupDialog.getByLabel(/Tên phân loại/).fill(groupName);
    await groupDialog.getByRole("button", { name: /Lưu$/ }).click();
    await expect(page.getByRole("heading", { name: groupName })).toBeVisible();

    for (const name of [`ROW A ${id}`, `ROW B ${id}`]) {
      await page.getByRole("button", { name: /Thêm dịch vụ/ }).click();
      const dialog = page.getByRole("dialog");
      await dialog.getByLabel(/^Dịch vụ/).fill(name);
      await dialog.getByRole("button", { name: /Lưu$/ }).click();
      await expect(dialog).toBeHidden();
      await expect(page.getByRole("row", { name: new RegExp(name) })).toBeVisible();
    }

    // Newest first, so ROW B leads until something is dragged.
    const names = page.locator("tbody tr.ant-table-row td:nth-child(2) p");
    await expect(names).toHaveText([`ROW B ${id}`, `ROW A ${id}`]);

    const firstRow = page.locator("tbody tr.ant-table-row").first();
    const secondRow = page.locator("tbody tr.ant-table-row").nth(1);
    const grip = firstRow.locator("td:first-child button");
    const gripBox = (await grip.boundingBox())!;
    const targetBox = (await secondRow.boundingBox())!;

    await page.mouse.move(gripBox.x + gripBox.width / 2, gripBox.y + gripBox.height / 2);
    await page.mouse.down();

    // Sideways as well as down: the lifted row follows the pointer on both
    // axes rather than being locked to the column.
    await page.mouse.move(gripBox.x + 90, targetBox.y + targetBox.height / 2, { steps: 12 });

    // The lifted row is the one being dragged, which by now has swapped into
    // the second slot — find it by its name, not by position.
    const draggedRow = page.locator("tbody tr.ant-table-row").filter({ hasText: `ROW B ${id}` });
    const lifted = await draggedRow.evaluate((row) => getComputedStyle(row).transform);
    expect(lifted).not.toBe("none");
    // matrix(a, b, c, d, translateX, translateY). The horizontal offset is the
    // interesting one: nothing but the pointer could have produced it, so the
    // row is not locked to its column. The vertical offset stays small on
    // purpose — the row has already been moved into the slot under the pointer.
    const [translateX] = lifted
      .replace(/^matrix\(|\)$/g, "")
      .split(",")
      .slice(4)
      .map((value) => Math.abs(Number(value.trim())));
    expect(translateX).toBeGreaterThan(40);

    // Rows swapped on the way, before the pointer was released.
    await expect(names).toHaveText([`ROW A ${id}`, `ROW B ${id}`]);

    // Record the table on every animation frame across the drop: the saved
    // order must never flash back, and the refetch that follows must not throw
    // a loading overlay over rows that are already correct.
    await page.evaluate(() => {
      const w = window as unknown as { __frames: string[] };
      w.__frames = [];
      const tick = () => {
        const first = document.querySelector("tbody tr.ant-table-row td:nth-child(2) p");
        const spinner = document
          .querySelector("tbody")
          ?.closest("div")
          ?.querySelector(".animate-spin");
        w.__frames.push((first?.textContent ?? "").trim() + (spinner ? " +overlay" : ""));
        if (w.__frames.length < 120) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });

    const [saved] = await Promise.all([
      page.waitForResponse(
        (res) =>
          res.url().includes("/api/v1/app/catalog-entries/reorder") &&
          res.request().method() === "POST",
        { timeout: 15_000 },
      ),
      page.waitForResponse(
        (res) =>
          res.url().includes("/api/v1/app/catalog-entries?") && res.request().method() === "GET",
        { timeout: 15_000 },
      ),
      page.mouse.up(),
    ]);
    expect(saved.ok()).toBeTruthy();

    const payload = saved.request().postDataJSON() as {
      taxonomyId: string;
      items: { id: string; order: number }[];
    };
    expect(payload.taxonomyId).toBeTruthy();
    expect(payload.items).toHaveLength(2);
    expect(payload.items.map((item) => item.order)).toEqual([0, 1]);

    await page.waitForTimeout(1500);
    const frames = await page.evaluate(
      () => (window as unknown as { __frames: string[] }).__frames,
    );
    const seen = [...new Set(frames.filter((row) => row.length > 0))];
    expect(seen, `the table changed mid-drop: ${seen.join(" → ")}`).toEqual([`ROW A ${id}`]);

    await page.reload();
    await expect(page.locator("tbody tr.ant-table-row td:nth-child(2) p")).toHaveText([
      `ROW A ${id}`,
      `ROW B ${id}`,
    ]);
  });
});
