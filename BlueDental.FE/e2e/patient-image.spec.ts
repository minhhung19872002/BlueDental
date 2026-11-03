import { expect, test, type Locator, type Page } from "@playwright/test";
import { assertRealApiTraffic, BRANCH2_USER, login, runId } from "./fixtures/auth";

/**
 * Feature F-24: tab "Hình ảnh" of the patient record.
 *
 * Runs against the real backend: pictures are uploaded to MinIO through the
 * API, reordered with a PUT, deleted with a DELETE, and every claim is checked
 * again after a reload so it is the database talking, not the cache.
 *
 * The tests share one run: the first uploads two pictures whose names carry
 * the run id, the later ones view, drag, and finally delete them, so the
 * patient is left as it was found. `workers: 1` keeps that order.
 */

const BRANCH_ONE = "11111111-1111-1111-1111-111111111111";
const IMAGES_API = "/api/v1/app/patient-images";

/** A 16×16 PNG — the smallest thing the server will accept as a picture. */
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAAAAAA6mKC9AAAAGUlEQVR42mNgAIL/QIBMkypAqX4YGATuAADA/X+BdAueyAAAAABJRU5ErkJggg==",
  "base64",
);

const id = runId();
const FIRST = `trong-a-${id}.png`;
const SECOND = `trong-b-${id}.png`;
const DROPPED = `trong-bo-${id}.png`;
/** One note for the whole batch; the run id keeps the search to this run's pictures. */
const NOTE = `Răng 16 sâu mặt nhai ${id}`;

type Stage = "Trước điều trị" | "Trong điều trị" | "Sau điều trị";
const STAGE_KEY: Record<Stage, string> = {
  "Trước điều trị": "before",
  "Trong điều trị": "during",
  "Sau điều trị": "after",
};

/**
 * A 1600×1200 PNG painted in the browser: big enough that any zoom spills
 * past the stage, which is what the drag-to-pan check needs.
 */
async function bigPng(page: Page): Promise<Buffer> {
  const base64 = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 1600;
    canvas.height = 1200;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("no 2d context");
    context.fillStyle = "#2671d8";
    context.fillRect(0, 0, 1600, 1200);
    context.fillStyle = "#ffffff";
    context.fillRect(200, 200, 1200, 800);
    return canvas.toDataURL("image/png").split(",")[1] ?? "";
  });
  return Buffer.from(base64, "base64");
}

function todayKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

async function openImageTab(page: Page): Promise<void> {
  await page.goto("/patient");
  await assertRealApiTraffic(page, "/api/v1/app/patients");

  await page.locator("tr.ant-table-row .bd-patient-name").first().click();
  await expect(page).toHaveURL(/\/patient\/[0-9a-f-]{36}/);

  // Armed before the click: the columns' list requests can beat a wait set up after it.
  const listed = assertRealApiTraffic(page, IMAGES_API);
  await page.getByRole("link", { name: "Hình ảnh" }).click();
  await expect(page).toHaveURL(/tab=image/);
  await listed;
}

async function chooseStage(page: Page, stage: Stage): Promise<void> {
  await page.getByRole("combobox", { name: "Giai đoạn điều trị" }).click();
  await page.locator(".ant-select-dropdown .ant-select-item-option", { hasText: stage }).click();
}

/** One "Giai đoạn điều trị" column of the tab. */
function column(page: Page, stage: Stage): Locator {
  return page.locator(`[data-testid="patient-image-stage"][data-stage="${STAGE_KEY[stage]}"]`);
}

function card(scope: Page | Locator, fileName: string): Locator {
  return scope.locator(`[data-testid="patient-image-card"]:has(button[aria-label="Xem ảnh ${fileName}"])`);
}

/** The file names of a column's tiles, top to bottom. */
function tileNames(scope: Locator): Promise<string[]> {
  return scope.getByTestId("patient-image-card").locator("img").evaluateAll((imgs) => imgs.map((img) => (img as HTMLImageElement).alt));
}

test.describe("Hình ảnh bệnh nhân", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("uploads two pictures into today's group of the Trong điều trị column", async ({ page }) => {
    await openImageTab(page);
    // Trước, Trong, Sau — one column each, each with its own "Tải ảnh".
    await expect(page.getByTestId("patient-image-stage")).toHaveCount(3);
    const stages = await page.getByTestId("patient-image-stage").evaluateAll((els) => els.map((el) => el.getAttribute("data-stage")));
    expect(stages).toEqual(["before", "during", "after"]);
    await expect(page.getByRole("button", { name: "Tải ảnh" })).toHaveCount(3);
    await expect(page.getByRole("button", { name: "Xóa lọc" })).toBeHidden();

    const during = column(page, "Trong điều trị");
    const stored: { fileName: string; type: number; note: string | null }[] = [];
    page.on("response", async (res) => {
      if (res.url().includes(IMAGES_API) && res.request().method() === "POST" && res.ok()) stored.push(await res.json());
    });

    // Picking opens the preview first; nothing is sent yet.
    await during.getByTestId("patient-image-input").setInputFiles([
      { name: FIRST, mimeType: "image/png", buffer: await bigPng(page) },
      { name: SECOND, mimeType: "image/png", buffer: PNG },
      { name: DROPPED, mimeType: "image/png", buffer: PNG },
    ]);
    const dialog = page.getByRole("dialog", { name: "Tải ảnh lên · Trong điều trị" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByTestId("picked-image")).toHaveCount(3);
    await expect(dialog).toContainText("3 ảnh đã chọn");
    expect(stored).toHaveLength(0);

    // One taken back with its ×, one note for the rest.
    await dialog.getByRole("button", { name: `Bỏ ảnh ${DROPPED}` }).click();
    await expect(dialog.getByTestId("picked-image")).toHaveCount(2);
    await expect(dialog).toContainText("Ghi chú được áp dụng cho cả 2 ảnh.");
    await dialog.getByLabel("Ghi chú").fill(`  ${NOTE}  `);
    await dialog.getByRole("button", { name: "Tải lên 2 ảnh" }).click();
    await expect(dialog).toBeHidden({ timeout: 20_000 });
    await expect(page.getByText("Đã tải 2 ảnh lên Trong điều trị")).toBeVisible();

    // Filed under the new stage (type 3), every one with the same trimmed note.
    await expect.poll(() => stored.length).toBe(2);
    expect(stored.map((image) => image.fileName).sort()).toEqual([FIRST, SECOND].sort());
    expect(stored.map((image) => image.type)).toEqual([3, 3]);
    expect(stored.map((image) => image.note)).toEqual([NOTE, NOTE]);

    await expect(card(during, FIRST)).toBeVisible({ timeout: 15_000 });
    await expect(card(during, DROPPED)).toHaveCount(0);
    await expect(card(during, SECOND)).toBeVisible();
    await expect(card(column(page, "Trước điều trị"), FIRST)).toHaveCount(0);
    await expect(card(column(page, "Sau điều trị"), FIRST)).toHaveCount(0);

    // Both land in today's group, and the day's count includes them.
    const today = during.getByTestId("patient-image-day").filter({ has: card(page, FIRST) });
    await expect(today).toHaveAttribute("data-day", todayKey());
    await expect(today.getByText(/^\d+ ảnh$/)).toBeVisible();
    await expect(card(today, SECOND)).toBeVisible();

    // The picture the tile shows is the blob the server stored.
    const img = card(page, FIRST).locator("img");
    await expect.poll(() => img.evaluate((i: HTMLImageElement) => i.naturalWidth)).toBeGreaterThan(0);

    // The filter narrows the tab to one column: "after" has none of them…
    await chooseStage(page, "Sau điều trị");
    await expect(page.getByRole("button", { name: "Xóa lọc" })).toBeVisible();
    await expect(page.getByTestId("patient-image-stage")).toHaveCount(1);
    await expect(card(page, FIRST)).toBeHidden();

    // …"during" has both…
    await chooseStage(page, "Trong điều trị");
    await expect(page.getByTestId("patient-image-stage")).toHaveCount(1);
    await expect(card(page, FIRST)).toBeVisible();

    // …and clearing the filter brings every column back.
    await page.getByRole("button", { name: "Xóa lọc" }).click();
    await expect(page.getByRole("button", { name: "Xóa lọc" })).toBeHidden();
    await expect(page.getByTestId("patient-image-stage")).toHaveCount(3);

    await page.reload();
    await expect(card(during, FIRST)).toBeVisible({ timeout: 15_000 });
    await expect(card(during, SECOND)).toBeVisible();
  });

  test("the search finds pictures by their note, marks or not, from the server", async ({ page }) => {
    await openImageTab(page);
    const during = column(page, "Trong điều trị");
    const search = page.getByRole("textbox", { name: "Tìm ảnh theo ghi chú" });

    // Typed without Vietnamese marks and in other case: the server folds both sides.
    const searched = page.waitForResponse(
      (res) => res.url().includes(IMAGES_API) && res.url().includes(`filter=`) && res.request().method() === "GET",
    );
    await search.fill(`RANG 16 SAU MAT NHAI ${id}`);
    expect((await searched).ok()).toBeTruthy();
    await expect(card(during, FIRST)).toBeVisible({ timeout: 15_000 });
    await expect(card(during, SECOND)).toBeVisible();
    await expect(during.getByTestId("patient-image-card")).toHaveCount(2);
    await expect(during).toContainText("2 ảnh khớp tìm kiếm");
    await expect(column(page, "Trước điều trị").getByTestId("patient-image-empty")).toHaveText(
      "Không có ảnh khớp với tìm kiếm.",
    );

    // The note is shown in the viewer too.
    await card(page, FIRST).getByRole("button", { name: `Xem ảnh ${FIRST}` }).click();
    const viewer = page.getByRole("dialog", { name: "Xem ảnh" });
    await expect(viewer).toContainText(NOTE);
    await page.keyboard.press("Escape");

    await search.fill(`khong-co-ghi-chu-nay-${id}`);
    await expect(during.getByTestId("patient-image-empty")).toHaveText("Không có ảnh khớp với tìm kiếm.", {
      timeout: 15_000,
    });

    // Cleared, every picture is back.
    await search.fill("");
    await expect(card(during, FIRST)).toBeVisible({ timeout: 15_000 });
  });

  test("a tile opens the viewer on that picture, and the arrows walk its column", async ({ page }) => {
    await openImageTab(page);
    await card(page, FIRST).getByRole("button", { name: `Xem ảnh ${FIRST}` }).click();

    const viewer = page.getByRole("dialog", { name: "Xem ảnh" });
    await expect(viewer).toBeVisible();
    await expect(viewer.getByRole("status")).toHaveText(FIRST);
    await expect(viewer.getByTestId("patient-image-counter")).toHaveText(/^\d+ \/ \d+$/);

    await viewer.getByRole("button", { name: "Ảnh sau" }).click();
    await expect(viewer.getByRole("status")).not.toHaveText(FIRST);
    await viewer.getByRole("button", { name: "Ảnh trước" }).click();
    await expect(viewer.getByRole("status")).toHaveText(FIRST);

    // Zoom: the button scales the picture, a zoomed picture drags about, the
    // wheel zooms too, and a double-click brings it back to rest.
    const frame = viewer.getByTestId("patient-image-frame");
    const zoomOf = () => frame.evaluate((el) => Number(getComputedStyle(el).getPropertyValue("--pi-zoom")));
    const panOf = () => frame.evaluate((el) => getComputedStyle(el).getPropertyValue("--pi-pan-y").trim());
    const scaleOf = () => frame.evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).a);
    const zoomIn = viewer.getByRole("button", { name: "Zoom gần" });
    const zoomOut = viewer.getByRole("button", { name: "Zoom xa" });
    // Nothing to drag until the picture itself has arrived.
    await expect
      .poll(() => frame.locator("img").evaluate((el) => (el as HTMLImageElement).complete && (el as HTMLImageElement).naturalWidth > 0))
      .toBe(true);
    await expect(zoomOut).toBeDisabled();
    await zoomIn.click();
    await expect(zoomOut).toBeEnabled();
    await expect.poll(zoomOf).toBe(1.5);
    await expect.poll(scaleOf).toBe(1.5);

    // The picture is now taller than its stage (the stage is wide, the
    // picture 4:3), so it drags up and down but stays put sideways.
    await expect(frame).toHaveClass(/pi-viewer-frame--pannable/);
    const box = await frame.boundingBox();
    expect(box).not.toBeNull();
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await page.mouse.down();
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2 - 60, { steps: 4 });
    await page.mouse.up();
    await expect.poll(panOf).not.toBe("0px");

    await frame.dblclick();
    await expect.poll(zoomOf).toBe(1);
    await expect.poll(panOf).toBe("0px");
    await expect(zoomOut).toBeDisabled();

    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await page.mouse.wheel(0, -100);
    await expect.poll(zoomOf).toBe(1.25);
    await page.mouse.wheel(0, 100);
    await expect.poll(zoomOf).toBe(1);

    // The pen: its palette opens above the black backdrop, and a colour sticks.
    await viewer.getByRole("button", { name: "Vẽ chú thích" }).click();
    await viewer.getByRole("button", { name: "Đổi màu hoặc độ dày nét vẽ" }).click();
    const palette = page.locator(".ant-popover:visible");
    await expect(palette).toBeVisible();
    // The colours only: the stroke sizes beside them keep a pressed one of their own.
    const colors = palette.locator(".pi-pen-colors");
    await colors.getByRole("button", { pressed: false }).first().click();
    await expect(colors.getByRole("button", { pressed: true })).toHaveCount(1);
    const topmost = await palette.evaluate((el) => {
      const box = el.getBoundingClientRect();
      const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
      return hit !== null && el.contains(hit);
    });
    expect(topmost).toBe(true);
    await expect(palette.getByLabel("Chọn màu tuỳ chỉnh")).toBeAttached();

    // A stroke can be undone, and putting the pen away wipes the drawing.
    const canvas = viewer.locator(".pi-annotation--active");
    const stage = await canvas.boundingBox();
    expect(stage).not.toBeNull();
    await page.mouse.move(stage!.x + stage!.width / 2, stage!.y + stage!.height / 2);
    await page.mouse.down();
    await page.mouse.move(stage!.x + stage!.width / 2 + 80, stage!.y + stage!.height / 2 + 40, { steps: 5 });
    await page.mouse.up();
    const undo = viewer.getByRole("button", { name: "Hoàn tác nét vẽ" });
    await expect(undo).toBeEnabled();
    await viewer.getByRole("button", { name: "Tắt chế độ vẽ" }).click();
    await viewer.getByRole("button", { name: "Vẽ chú thích" }).click();
    await expect(undo).toBeDisabled();
    await viewer.getByRole("button", { name: "Tắt chế độ vẽ" }).click();

    await page.keyboard.press("Escape");
    await expect(viewer).toBeHidden();

    // A click on the black backdrop closes it too; one on the picture does not.
    await card(page, FIRST).getByRole("button", { name: `Xem ảnh ${FIRST}` }).click();
    await expect(viewer).toBeVisible();
    await frame.locator("img").click();
    await expect(viewer).toBeVisible();
    await viewer.locator(".pi-viewer-stage").click({ position: { x: 8, y: 8 } });
    await expect(viewer).toBeHidden();
  });

  test("dragging a tile by its grip reorders the day, and the order survives a reload", async ({ page }) => {
    await openImageTab(page);

    const during = column(page, "Trong điều trị");
    const first = card(during, FIRST);
    const second = card(during, SECOND);
    await second.hover();
    const from = await second.getByRole("button", { name: "Sắp xếp ảnh" }).boundingBox();
    const to = await first.boundingBox();
    expect(from).not.toBeNull();
    expect(to).not.toBeNull();

    const reordered = page.waitForResponse(
      (res) => res.url().includes(`${IMAGES_API}/reorder`) && res.request().method() === "PUT",
    );
    await page.mouse.move(from!.x + from!.width / 2, from!.y + from!.height / 2);
    await page.mouse.down();
    await page.mouse.move(from!.x - 10, from!.y + from!.height / 2, { steps: 4 });
    await page.mouse.move(to!.x + to!.width / 2, to!.y + to!.height / 2, { steps: 12 });
    await page.mouse.up();
    expect((await reordered).ok()).toBeTruthy();

    const orderOf = async () => {
      const names = await tileNames(during);
      return names.indexOf(SECOND) < names.indexOf(FIRST);
    };
    await expect.poll(orderOf).toBe(true);

    await page.reload();
    await expect(first).toBeVisible({ timeout: 15_000 });
    await expect.poll(orderOf).toBe(true);
  });

  test("deleting asks first, then the picture is gone for good", async ({ page }) => {
    await openImageTab(page);

    for (const name of [SECOND, FIRST]) {
      await card(page, name).getByRole("button", { name: "Xóa ảnh" }).click();
      const dialog = page.getByRole("dialog").filter({ hasText: "Xác nhận xoá ảnh" });
      await expect(dialog).toContainText("Bạn có chắc muốn xoá ảnh này không?");

      const deleted = page.waitForResponse(
        (res) => res.url().includes(IMAGES_API) && res.request().method() === "DELETE",
      );
      await dialog.getByRole("button", { name: "Xoá" }).click();
      expect((await deleted).ok()).toBeTruthy();
      await expect(page.getByText("Đã xoá ảnh").first()).toBeVisible();
      await expect(card(page, name)).toBeHidden();
    }

    // Arm the wait before the reload so the list request cannot slip past it.
    const relisted = page.waitForResponse(
      (res) => res.url().includes(IMAGES_API) && res.request().method() === "GET",
    );
    await page.reload();
    expect((await relisted).ok()).toBeTruthy();
    await expect(page.getByTestId("patient-image-tab")).toBeVisible();
    await expect(card(page, FIRST)).toBeHidden();
    await expect(card(page, SECOND)).toBeHidden();
  });

  test("a branch-scoped account cannot read another branch's pictures", async ({ page }) => {
    await login(page, BRANCH2_USER);

    // The list is scoped like every other branch resource: naming a branch the
    // account is not assigned to is refused outright, not answered empty.
    const status = await page.evaluate(
      async ([api, branch]) => {
        const res = await fetch(`${api}?clinicBranchId=${branch}`, {
          headers: { accept: "application/json" },
        });
        return res.status;
      },
      [IMAGES_API, BRANCH_ONE] as const,
    );
    expect(status).toBe(403);
  });
});
