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
const FIRST = `truoc-a-${id}.png`;
const SECOND = `truoc-b-${id}.png`;

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

  await page.getByRole("link", { name: "Hình ảnh" }).click();
  await expect(page).toHaveURL(/tab=image/);
  await assertRealApiTraffic(page, IMAGES_API);
}

async function chooseStage(page: Page, stage: "Trước điều trị" | "Sau điều trị"): Promise<void> {
  await page.getByRole("combobox", { name: "Giai đoạn điều trị" }).click();
  await page.locator(".ant-select-dropdown .ant-select-item-option", { hasText: stage }).click();
  await assertRealApiTraffic(page, "type=");
}

function card(page: Page, fileName: string): Locator {
  return page.getByTestId("patient-image-card").filter({ hasText: fileName });
}

test.describe("Hình ảnh bệnh nhân", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("uploads two pictures into today's group under the chosen stage", async ({ page }) => {
    await openImageTab(page);
    await expect(page.getByRole("button", { name: "Tải ảnh" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Xóa lọc" })).toBeHidden();

    await chooseStage(page, "Trước điều trị");
    await expect(page.getByRole("button", { name: "Xóa lọc" })).toBeVisible();

    const uploaded = page.waitForResponse(
      (res) => res.url().includes(IMAGES_API) && res.request().method() === "POST" && res.ok(),
    );
    await page.getByTestId("patient-image-input").setInputFiles([
      { name: FIRST, mimeType: "image/png", buffer: await bigPng(page) },
      { name: SECOND, mimeType: "image/png", buffer: PNG },
    ]);
    await uploaded;

    await expect(card(page, FIRST)).toBeVisible({ timeout: 15_000 });
    await expect(card(page, SECOND)).toBeVisible();

    // Both land in today's group, and the day's count includes them.
    const today = page.getByTestId("patient-image-day").filter({ has: card(page, FIRST) });
    await expect(today).toHaveAttribute("data-day", todayKey());
    await expect(today.getByText(/^\d+ ảnh$/)).toBeVisible();
    await expect(today).toContainText(SECOND);

    // The picture the card shows is the blob the server stored.
    const img = card(page, FIRST).locator("img");
    await expect.poll(() => img.evaluate((i: HTMLImageElement) => i.naturalWidth)).toBeGreaterThan(0);

    // They were tagged "before", so the "after" filter hides them…
    await chooseStage(page, "Sau điều trị");
    await expect(card(page, FIRST)).toBeHidden();

    // …and clearing the filter brings everything back.
    await page.getByRole("button", { name: "Xóa lọc" }).click();
    await expect(page.getByRole("button", { name: "Xóa lọc" })).toBeHidden();
    await expect(card(page, FIRST)).toBeVisible();

    await page.reload();
    await expect(card(page, FIRST)).toBeVisible({ timeout: 15_000 });
    await expect(card(page, SECOND)).toBeVisible();
  });

  test("the eye opens the viewer on that picture, and the arrows walk the set", async ({ page }) => {
    await openImageTab(page);
    await card(page, FIRST).getByRole("button", { name: "Xem ảnh", exact: true }).click();

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
    const swatches = palette.getByRole("button", { pressed: false });
    await swatches.first().click();
    await expect(palette.getByRole("button", { pressed: true })).toHaveCount(1);
    const topmost = await palette.evaluate((el) => {
      const box = el.getBoundingClientRect();
      const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
      return hit !== null && el.contains(hit);
    });
    expect(topmost).toBe(true);
    await expect(palette.getByLabel("Màu tùy chọn")).toBeAttached();

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
    await card(page, FIRST).getByRole("button", { name: "Xem ảnh", exact: true }).click();
    await expect(viewer).toBeVisible();
    await frame.locator("img").click();
    await expect(viewer).toBeVisible();
    await viewer.locator(".pi-viewer-stage").click({ position: { x: 8, y: 8 } });
    await expect(viewer).toBeHidden();
  });

  test("dragging a card by its grip reorders the day, and the order survives a reload", async ({ page }) => {
    await openImageTab(page);

    const first = card(page, FIRST);
    const second = card(page, SECOND);
    const grip = second.getByRole("button", { name: "Sắp xếp ảnh" });
    const from = await grip.boundingBox();
    const to = await first.getByRole("button", { name: "Sắp xếp ảnh" }).boundingBox();
    expect(from).not.toBeNull();
    expect(to).not.toBeNull();

    const reordered = page.waitForResponse(
      (res) => res.url().includes(`${IMAGES_API}/reorder`) && res.request().method() === "PUT",
    );
    await page.mouse.move(from!.x + from!.width / 2, from!.y + from!.height / 2);
    await page.mouse.down();
    await page.mouse.move(from!.x - 20, from!.y + from!.height / 2, { steps: 4 });
    await page.mouse.move(to!.x + to!.width / 2 - 40, to!.y + to!.height / 2, { steps: 12 });
    await page.mouse.up();
    expect((await reordered).ok()).toBeTruthy();

    const orderOf = async () => {
      const names = await page.getByTestId("patient-image-card").locator(".pi-card-name").allTextContents();
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
