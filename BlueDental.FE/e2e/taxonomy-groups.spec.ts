import { expect, test, type Page } from "@playwright/test";
import { login, runId } from "./fixtures/auth";

/**
 * Feature: the classification-group panel of Danh mục — its dialog, its search
 * and its drag-to-reorder.
 *
 * Real stack only: real login, real ASP.NET Core API, real PostgreSQL.
 */

const PANEL = 'nav[aria-label^="Nhóm"]';

/** `#e5484d` and `rgb(229, 72, 77)` are the same colour; compare them as one. */
function toRgb(colour: string): string {
  if (!colour.startsWith("#")) return colour;

  const hex = colour.slice(1);
  const pair = (at: number) => parseInt(hex.slice(at, at + 2), 16);
  return `rgb(${pair(0)}, ${pair(2)}, ${pair(4)})`;
}

/** Names of the group rows, in the order the panel is showing them. */
async function groupOrder(page: Page): Promise<string[]> {
  return page
    .locator(`${PANEL} li button[aria-current], ${PANEL} li > div > button:first-child`)
    .allInnerTexts()
    .then((names) => names.map((name) => name.trim()));
}

async function createGroup(page: Page, name: string, priority: string) {
  await page.getByRole("button", { name: "Thêm nhóm phân loại" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "Tạo nhóm" })).toBeVisible();

  await dialog.getByLabel(/Tên phân loại/).fill(name);
  await dialog.getByLabel(/Mức độ ưu tiên/).fill(priority);
  await dialog.getByRole("button", { name: /Lưu$/ }).click();
  await expect(dialog).toBeHidden();
}

test.describe("Danh mục — nhóm phân loại", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto("/taxonomy/service");
    await expect(page.getByRole("button", { name: "Thêm nhóm phân loại" })).toBeVisible();
  });

  test("stores the priority typed into the dialog and sorts by it", async ({ page }) => {
    const id = runId();
    const early = `AAA ƯU TIÊN ${id}`;
    const late = `AAA SAU ${id}`;

    // Same prefix so a tie would fall back to the name; the priority is what
    // has to decide the order here.
    await createGroup(page, late, "900");
    await createGroup(page, early, "1");

    await page.locator("#taxonomy-group-search").fill(`AAA`);
    await expect(page.getByRole("button", { name: early, exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: late, exact: true })).toBeVisible();

    const order = await groupOrder(page);
    expect(order.indexOf(early)).toBeLessThan(order.indexOf(late));

    // The saved priority comes back into the dialog rather than resetting.
    await page.locator(`[data-group-menu="${early}"]`).click();
    await page.getByRole("menuitem", { name: "Chỉnh sửa" }).click();
    await expect(page.getByRole("dialog").getByLabel(/Mức độ ưu tiên/)).toHaveValue("1");
  });

  test("searches groups on the server, not in the browser", async ({ page }) => {
    const id = runId();
    const name = `ZZZ TÌM ${id}`;
    await createGroup(page, name, "0");

    // The request carries the term: a client-side filter would send nothing.
    const [request] = await Promise.all([
      page.waitForRequest(
        (req) =>
          req.url().includes("/api/v1/app/taxonomies") &&
          (new URL(req.url()).searchParams.get("filter") ?? "").includes("ZZZ"),
        { timeout: 15_000 },
      ),
      page.locator("#taxonomy-group-search").fill(`ZZZ TÌM ${id}`),
    ]);
    expect(request.method()).toBe("GET");

    await expect(page.getByRole("button", { name, exact: true })).toBeVisible();
    await expect(page.locator(`${PANEL} li`)).toHaveCount(1);

    // A term the server cannot match empties the panel.
    await page.locator("#taxonomy-group-search").fill(`KHONGCOTHAT ${id}`);
    await expect(page.getByText("Không tìm thấy nhóm phù hợp")).toBeVisible();

    // Clearing it brings the catalog back.
    await page.locator("#taxonomy-group-search").fill("");
    await expect(page.locator(`${PANEL} li`).first()).toBeVisible();
    expect((await groupOrder(page)).length).toBeGreaterThan(1);
  });

  test("matches regardless of case, padding or word order", async ({ page }) => {
    const id = runId();
    const name = `Trám Răng Sứ ${id}`;
    await createGroup(page, name, "0");

    const search = page.locator("#taxonomy-group-search");
    const row = page.getByRole("button", { name, exact: true });

    // Lower case, upper case, padded, and with the words the other way round —
    // all four are the same search.
    for (const term of [
      `trám răng sứ ${id}`,
      `TRÁM RĂNG SỨ ${id}`,
      `   Trám   Răng   Sứ   ${id}   `,
      `${id} sứ trám`,
    ]) {
      await search.fill(term);
      await expect(row, `"${term}" should find the group`).toBeVisible();
    }

    // A word the row does not carry excludes it: every term has to match.
    await search.fill(`trám ${id} implant`);
    await expect(page.getByText("Không tìm thấy nhóm phù hợp")).toBeVisible();

    // Whitespace alone is not a search — the whole catalog comes back.
    await search.fill("     ");
    await expect(page.locator(`${PANEL} li`).first()).toBeVisible();
    expect((await groupOrder(page)).length).toBeGreaterThan(1);
  });

  test("puts a newly created group at the top", async ({ page }) => {
    const id = runId();
    const older = `ZZ CU ${id}`;
    const newer = `AA MOI ${id}`;

    await page.goto("/taxonomy/service");
    await createGroup(page, older, "0");

    await createGroup(page, newer, "0");

    // Newest first: the second group sorts above the first even though its name
    // would come first alphabetically either way — same priority, later clock.
    const order = await groupOrder(page);
    expect(order.indexOf(newer)).toBeLessThan(order.indexOf(older));
    expect(order[0]).toBe(newer);

    // An explicit priority still wins over recency. Narrow the panel to these
    // two first: a raised priority sorts below every other group in the branch,
    // and the assertion is about the pair, not about where they land overall.
    await page.locator(`[data-group-menu="${newer}"]`).click();
    await page.getByRole("menuitem", { name: "Chỉnh sửa" }).click();
    const edit = page.getByRole("dialog");
    await edit.getByLabel(/Mức độ ưu tiên/).fill("500");
    await edit.getByRole("button", { name: /Lưu$/ }).click();
    await expect(edit).toBeHidden();

    await page.locator("#taxonomy-group-search").fill(id);
    await expect(page.locator(`${PANEL} li`)).toHaveCount(2);
    const reordered = await groupOrder(page);
    expect(reordered.indexOf(older)).toBeLessThan(reordered.indexOf(newer));
  });

  test("says it is saving while the save is in flight", async ({ page }) => {
    const id = runId();

    await page.goto("/taxonomy/service");

    // Slow the connection rather than fake a response: the API still answers
    // for real, there is just enough latency to see the button's working state
    // instead of racing it.
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Network.enable");
    await cdp.send("Network.emulateNetworkConditions", {
      offline: false,
      latency: 600,
      downloadThroughput: -1,
      uploadThroughput: -1,
    });

    await page.getByRole("button", { name: "Thêm nhóm phân loại" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel(/Tên phân loại/).fill(`CHAM ${id}`);

    const save = dialog.getByRole("button", { name: /Lưu$/ });
    await save.click();

    await expect(dialog.getByRole("button", { name: /Đang lưu/ })).toBeVisible();
    await expect(dialog.getByRole("button", { name: /Đang lưu/ })).toBeDisabled();

    await cdp.send("Network.emulateNetworkConditions", {
      offline: false,
      latency: 0,
      downloadThroughput: -1,
      uploadThroughput: -1,
    });
    await expect(dialog).toBeHidden({ timeout: 20_000 });
    await expect(page.getByRole("button", { name: `CHAM ${id}`, exact: true })).toBeVisible();
  });

  test("says it is deleting while the delete is in flight", async ({ page }) => {
    const id = runId();
    const name = `CHAM XOA ${id}`;

    await page.goto("/taxonomy/service");
    await createGroup(page, name, "0");

    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Network.enable");
    await cdp.send("Network.emulateNetworkConditions", {
      offline: false,
      latency: 600,
      downloadThroughput: -1,
      uploadThroughput: -1,
    });

    await page.locator(`[data-group-menu="${name}"]`).click();
    await page.getByRole("menuitem", { name: "Xoá" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: /Xoá$/ }).click();

    await expect(dialog.getByRole("button", { name: /Đang xoá/ })).toBeVisible();

    await cdp.send("Network.emulateNetworkConditions", {
      offline: false,
      latency: 0,
      downloadThroughput: -1,
      uploadThroughput: -1,
    });
    await expect(dialog).toBeHidden({ timeout: 20_000 });
  });

  test("names the group in the delete confirmation and colours the button red", async ({
    page,
  }) => {
    const id = runId();
    const name = `XOA NHOM ${id}`;
    await createGroup(page, name, "0");

    await page.locator(`[data-group-menu="${name}"]`).click();
    await page.getByRole("menuitem", { name: "Xoá" }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "Xác nhận xoá nhóm" })).toBeVisible();
    // The record being deleted is picked out of the sentence, not left to the
    // user to remember which row they clicked.
    await expect(dialog.locator("strong")).toHaveText(name);
    await expect(dialog.getByText("Hành động này không thể hoàn tác.")).toBeVisible();

    // A delete cannot be taken back, so its button is not the same as "Lưu":
    // it carries the theme's error colour rather than the primary one.
    const remove = dialog.getByRole("button", { name: /Xoá$/ });
    const [colour, danger, primary] = await remove.evaluate((el) => {
      // Ant Design scopes its variables to a generated class rather than :root,
      // so they are read from the button, where they are in scope.
      const style = getComputedStyle(el);
      return [
        style.backgroundColor,
        style.getPropertyValue("--ant-color-error").trim(),
        style.getPropertyValue("--ant-color-primary").trim(),
      ];
    });

    // Read from the token rather than pinned to a hex: the palette has been
    // repainted once already and left this asserting the old red.
    expect(toRgb(danger)).toBe(colour);
    expect(toRgb(primary)).not.toBe(colour);

    await remove.click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole("button", { name, exact: true })).toHaveCount(0);
  });

  test("drags a group into a new position and keeps it after a reload", async ({ page }) => {
    const id = runId();
    // Two groups of our own at the *top* of the list — default priority plus
    // newest-first puts them there, so the drag has a known pair to swap
    // without depending on how many other groups the branch holds.
    const second = `KEO B ${id}`;
    const first = `KEO A ${id}`;
    await createGroup(page, second, "0");
    await createGroup(page, first, "0");

    const rowOf = (name: string) => page.locator(`${PANEL} li`).filter({ hasText: name });

    const before = await groupOrder(page);
    expect(before.indexOf(first)).toBeLessThan(before.indexOf(second));

    // Drag the first one onto the second: a real pointer gesture, which the
    // HTML5 drag implementation could not have answered at all.
    const source = rowOf(first);
    const target = rowOf(second);
    await source.hover();
    const grip = source.getByRole("button", { name: "Kéo để sắp xếp" });
    const gripBox = (await grip.boundingBox())!;
    const targetBox = (await target.boundingBox())!;

    await page.mouse.move(gripBox.x + gripBox.width / 2, gripBox.y + gripBox.height / 2);
    await page.mouse.down();
    // Several steps, so the panel reorders under the pointer on the way rather
    // than only on release.
    await page.mouse.move(gripBox.x + gripBox.width / 2, targetBox.y + targetBox.height / 2, {
      steps: 12,
    });

    const during = await groupOrder(page);
    expect(during.indexOf(second)).toBeLessThan(during.indexOf(first));

    // Record the panel on every animation frame across the drop. The saved
    // order must never flash back to what it was: the cache is updated
    // optimistically, so releasing the pointer is the last visual change.
    await page.evaluate(() => {
      const w = window as unknown as { __frames: string[] };
      w.__frames = [];
      const tick = () => {
        const row = document.querySelector('nav[aria-label^="Nhóm"] li');
        w.__frames.push((row?.textContent ?? "").trim());
        if (w.__frames.length < 120) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });

    // The drop saves in ONE request carrying the whole order, then refetches;
    // reloading before that lands would cancel the write mid-flight.
    const [saved, refetch] = await Promise.all([
      page.waitForResponse(
        (res) =>
          res.url().includes("/api/v1/app/taxonomies/reorder") && res.request().method() === "POST",
        { timeout: 15_000 },
      ),
      page.waitForResponse(
        (res) => res.url().includes("/api/v1/app/taxonomies?") && res.request().method() === "GET",
        { timeout: 15_000 },
      ),
      page.mouse.up(),
    ]);
    expect(saved.ok()).toBeTruthy();
    expect(refetch.ok()).toBeTruthy();

    await page.waitForTimeout(1500);
    const frames = await page.evaluate(
      () => (window as unknown as { __frames: string[] }).__frames,
    );
    const settled = frames.filter((row) => row.length > 0);
    expect(
      new Set(settled).size,
      `first row changed mid-drop: ${[...new Set(settled)].join(" → ")}`,
    ).toBe(1);

    // One drag is one call: no per-row PUT went out alongside it.
    const payload = saved.request().postDataJSON() as {
      group: string;
      items: { id: string; order: number }[];
    };
    expect(payload.group).toBe("care_service");
    expect(payload.items.length).toBeGreaterThan(1);
    expect(payload.items.map((item) => item.order)).toEqual(payload.items.map((_, index) => index));

    await page.reload();
    await expect(page.getByRole("button", { name: first, exact: true })).toBeVisible();
    const after = await groupOrder(page);
    expect(after.indexOf(second)).toBeLessThan(after.indexOf(first));
  });
});

/**
 * Feature: the form Nguồn đến, Lịch sử bệnh and Nghề nghiệp share on the
 * reference — a name, its group, the two state checkboxes and a priority.
 */
test.describe("Danh mục — màn hình đơn giản", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("creates a Nguồn đến with only the fields the reference offers", async ({ page }) => {
    const id = runId();
    const groupName = `NGUON ${id}`;
    const name = `Facebook ${id}`;

    await page.goto("/taxonomy/source");
    await createGroup(page, groupName, "0");

    await page.getByRole("button", { name: "Thêm nguồn đến" }).click();
    const dialog = page.getByRole("dialog");

    // Exactly the reference's field set — no price, no code, no description.
    await expect(dialog.getByLabel(/Tên nguồn đến/)).toBeVisible();
    await expect(dialog.getByLabel(/Chọn nhóm nguồn đến/)).toBeVisible();
    await expect(dialog.getByLabel("Đang hoạt động")).toBeChecked();
    await expect(dialog.getByLabel("Đã xoá")).toBeDisabled();
    await expect(dialog.getByLabel(/Mức độ ưu tiên/)).toHaveValue("0");
    await expect(dialog.getByRole("button", { name: "Huỷ" })).toHaveCount(0);

    await dialog.getByLabel(/Tên nguồn đến/).fill(name);
    await dialog.getByRole("button", { name: /Lưu$/ }).click();
    await expect(dialog).toBeHidden();

    await expect(page.getByRole("row", { name: new RegExp(name) })).toBeVisible();

    await page.reload();
    await expect(page.getByRole("row", { name: new RegExp(name) })).toBeVisible();
  });

  test('"Đã xoá" parks the record, and "Đang hoạt động" brings it back', async ({ page }) => {
    const id = runId();
    const groupName = `NGHE ${id}`;
    const name = `Kỹ sư ${id}`;

    await page.goto("/taxonomy/occupation");
    await createGroup(page, groupName, "0");

    // The reference gives this catalog no export button. Exact match: the
    // sidebar's "Đăng xuất" contains this word too.
    await expect(page.getByRole("button", { name: "Xuất", exact: true })).toHaveCount(0);

    await page.getByRole("button", { name: /Thêm nghề nghiệp$/ }).click();
    let dialog = page.getByRole("dialog");
    await dialog.getByLabel(/Tên nghề nghiệp/).fill(name);
    await dialog.getByRole("button", { name: /Lưu$/ }).click();
    await expect(dialog).toBeHidden();

    const row = page.getByRole("row", { name: new RegExp(name) });
    await expect(row).toBeVisible();
    // A live record offers both "Chỉnh sửa" and "Xoá".
    await expect(row.getByRole("button", { name: /^Xoá / })).toBeVisible();

    // ── Park it ────────────────────────────────────────────────────────────
    await row.getByRole("button", { name: /^Chỉnh sửa / }).click();
    dialog = page.getByRole("dialog");
    await dialog.getByLabel("Đã xoá").click();
    await expect(dialog.getByLabel("Đã xoá")).toBeChecked();
    // The pair is one state, so ticking one clears the other.
    await expect(dialog.getByLabel("Đang hoạt động")).not.toBeChecked();
    await dialog.getByRole("button", { name: /Lưu$/ }).click();
    await expect(dialog).toBeHidden();

    // Soft, not gone: the row keeps its place and loses only its delete action.
    await expect(row).toBeVisible();
    await expect(row.getByRole("button", { name: /^Xoá / })).toHaveCount(0);
    await expect(row.getByRole("button", { name: /^Chỉnh sửa / })).toBeVisible();

    // The server said so, not the page.
    await page.reload();
    await expect(row).toBeVisible();
    await expect(row.getByRole("button", { name: /^Xoá / })).toHaveCount(0);

    // ── Bring it back ──────────────────────────────────────────────────────
    await row.getByRole("button", { name: /^Chỉnh sửa / }).click();
    dialog = page.getByRole("dialog");
    await expect(dialog.getByLabel("Đã xoá")).toBeChecked();
    await dialog.getByLabel("Đang hoạt động").click();
    await expect(dialog.getByLabel("Đã xoá")).not.toBeChecked();
    await dialog.getByRole("button", { name: /Lưu$/ }).click();
    await expect(dialog).toBeHidden();

    await page.reload();
    await expect(row.getByRole("button", { name: /^Xoá / })).toBeVisible();
  });

  test("the bin icon is a soft delete too, on a catalog that offers the pair", async ({
    page,
  }) => {
    const id = runId();
    const groupName = `NGHE BIN ${id}`;
    const name = `Thợ ${id}`;

    await page.goto("/taxonomy/occupation");
    await createGroup(page, groupName, "0");

    await page.getByRole("button", { name: /Thêm nghề nghiệp$/ }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel(/Tên nghề nghiệp/).fill(name);
    await dialog.getByRole("button", { name: /Lưu$/ }).click();
    await expect(dialog).toBeHidden();

    const row = page.getByRole("row", { name: new RegExp(name) });
    await row.getByRole("button", { name: /^Xoá / }).click();

    const confirm = page.getByRole("dialog");
    await confirm.getByRole("button", { name: /Xoá$/ }).click();
    await expect(confirm).toBeHidden();

    // Still there, still editable — the delete can be taken back.
    await page.reload();
    await expect(row).toBeVisible();
    await expect(row.getByRole("button", { name: /^Xoá / })).toHaveCount(0);
  });
});
