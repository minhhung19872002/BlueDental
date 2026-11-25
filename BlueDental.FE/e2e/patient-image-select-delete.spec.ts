import { expect, test, type Locator, type Page, type Response } from "@playwright/test";
import { assertRealApiTraffic, BRANCH2_USER, login, runId } from "./fixtures/auth";
import { call } from "./fixtures/timekeepingStaff";

/**
 * R-1277: tab "Hình ảnh" — tick several pictures of a column and delete them
 * in one go ("Xoá N ảnh"), instead of one trash click and one confirm each.
 *
 * Login, API, MinIO and PostgreSQL are real and nothing is intercepted. Every
 * picture is uploaded by the test itself and the selection never reaches past
 * them, so pictures already on the record are left alone; whatever a failed
 * run leaves behind is deleted again in `finally`.
 */

const BRANCH_ONE = "11111111-1111-1111-1111-111111111111";
const IMAGES_API = "/api/v1/app/patient-images";
const DELETE_MANY = `${IMAGES_API}/delete-many`;

/** A 16×16 PNG — the smallest thing the server will accept as a picture. */
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAAAAAA6mKC9AAAAGUlEQVR42mNgAIL/QIBMkypAqX4YGATuAADA/X+BdAueyAAAAABJRU5ErkJggg==",
  "base64",
);

interface UploadedImage {
  id: string;
  fileName: string;
}

interface ImageList {
  items: UploadedImage[];
}

async function openImageTab(page: Page): Promise<string> {
  await page.goto("/patient");
  await assertRealApiTraffic(page, "/api/v1/app/patients");
  await page.locator("tr.ant-table-row .bd-patient-name").first().click();
  await expect(page).toHaveURL(/\/patient\/[0-9a-f-]{36}/);
  const patientId = /\/patient\/([0-9a-f-]{36})/.exec(page.url())?.[1] ?? "";

  const listed = assertRealApiTraffic(page, IMAGES_API);
  await page.getByRole("link", { name: "Hình ảnh" }).click();
  await expect(page).toHaveURL(/tab=image/);
  await listed;
  return patientId;
}

function beforeColumn(page: Page): Locator {
  return page.locator('[data-testid="patient-image-stage"][data-stage="before"]');
}

function cardOf(page: Page, fileName: string): Locator {
  return beforeColumn(page).getByTestId("patient-image-card").filter({ has: page.locator(`img[alt="${fileName}"]`) });
}

function selectionBar(page: Page): Locator {
  return beforeColumn(page).getByTestId("patient-image-selection-bar");
}

function collectStored(page: Page): UploadedImage[] {
  const stored: UploadedImage[] = [];
  page.on("response", async (res: Response) => {
    const req = res.request();
    if (req.method() === "POST" && new URL(req.url()).pathname === IMAGES_API && res.ok()) {
      stored.push((await res.json()) as UploadedImage);
    }
  });
  return stored;
}

/** Sends `names` through "Tải ảnh" of the Trước điều trị column and waits for every card. */
async function uploadPictures(page: Page, stored: UploadedImage[], names: string[]): Promise<void> {
  await beforeColumn(page)
    .getByTestId("patient-image-input")
    .setInputFiles(names.map((name) => ({ name, mimeType: "image/png", buffer: PNG })));
  const dialog = page.getByRole("dialog", { name: "Tải ảnh lên · Trước điều trị" });
  await dialog.getByRole("button", { name: `Tải lên ${names.length} ảnh` }).click();
  await expect.poll(() => stored.length, { timeout: 60_000 }).toBe(names.length);
  for (const name of names) await expect(cardOf(page, name)).toBeVisible({ timeout: 15_000 });
}

async function storedIds(page: Page, patientId: string): Promise<string[]> {
  const res = await call<ImageList>(
    page,
    `${IMAGES_API}?patientId=${patientId}&clinicBranchId=${BRANCH_ONE}&maxResultCount=1000`,
    { branchId: BRANCH_ONE },
  );
  expect(res.status).toBe(200);
  return res.body.items.map((image) => image.id);
}

/** Deletes whatever of `images` a failed run left on the record; a passing run left nothing. */
async function removeLeftovers(page: Page, patientId: string, images: UploadedImage[]): Promise<void> {
  if (page.isClosed() || !images.length) return;
  const left = await storedIds(page, patientId);
  for (const image of images.filter((each) => left.includes(each.id))) {
    const res = await call(page, `${IMAGES_API}/${image.id}`, { method: "DELETE", branchId: BRANCH_ONE });
    expect(res.status).toBeLessThan(300);
  }
}

test.describe("Hình ảnh — chọn nhiều để xoá (R-1277)", () => {
  test.describe.configure({ timeout: 120_000 });

  test("tick, Shift+click a run, untick, Esc, then delete the ticked ones in one request", async ({ page }) => {
    await login(page);
    const patientId = await openImageTab(page);
    const id = runId();
    const names = Array.from({ length: 5 }, (_, i) => `chon-${id}-${i + 1}.png`);
    const stored = collectStored(page);

    try {
      await uploadPictures(page, stored, names);
      const column = beforeColumn(page);

      // Before a selection: the tick is offered on the tile, the head is the stage's own.
      await expect(selectionBar(page)).toHaveCount(0);
      // Measured against the column, so the scroll a click may make does not count.
      const offsetInColumn = async (target: Locator) =>
        ((await target.boundingBox())?.y ?? NaN) - ((await column.boundingBox())?.y ?? NaN);
      const headHeight = (await column.locator(".pi-stage-head").boundingBox())?.height;
      const firstCardOffset = await offsetInColumn(cardOf(page, names[0]));
      await column.getByRole("checkbox", { name: `Chọn ảnh ${names[0]}` }).click();
      await expect(selectionBar(page)).toContainText("1 ảnh đã chọn");

      // The bar takes the head's place at the head's height: nothing below it moves.
      expect((await selectionBar(page).boundingBox())?.height).toBe(headHeight);
      expect(await offsetInColumn(cardOf(page, names[0]))).toBe(firstCardOffset);

      // Selecting: the upload, the grip and the trash step aside; a click on a picture ticks it.
      await expect(column.getByRole("button", { name: "Tải ảnh" })).toHaveCount(0);
      await expect(column.getByRole("button", { name: "Sắp xếp ảnh" })).toHaveCount(0);
      await expect(column.getByRole("button", { name: "Xóa ảnh" })).toHaveCount(0);
      await column.getByRole("button", { name: `Chọn ảnh ${names[1]}` }).click();
      await expect(page.locator(".pi-viewer, [data-testid='patient-image-viewer']")).toHaveCount(0);
      await expect(column.getByRole("button", { name: `Chọn ảnh ${names[1]}` })).toHaveAttribute("aria-pressed", "true");
      await expect(selectionBar(page)).toContainText("2 ảnh đã chọn");

      // Shift+click ticks the run from the last one ticked.
      await column.getByRole("button", { name: `Chọn ảnh ${names[4]}` }).click({ modifiers: ["Shift"] });
      await expect(selectionBar(page)).toContainText("5 ảnh đã chọn");
      await column.getByRole("button", { name: `Chọn ảnh ${names[2]}` }).click();
      await expect(selectionBar(page)).toContainText("4 ảnh đã chọn");

      // Esc leaves the selection and gives the column back.
      await page.keyboard.press("Escape");
      await expect(selectionBar(page)).toHaveCount(0);
      await expect(column.getByRole("button", { name: "Tải ảnh" })).toBeVisible();

      // "Chọn cả ngày" ticks the day (at least our five); unticking it leaves the selection.
      const day = column.getByTestId("patient-image-day").filter({ has: page.locator(`img[alt="${names[0]}"]`) });
      const dayTick = day.getByRole("checkbox", { name: /^Chọn cả ngày/ });
      await dayTick.check();
      await expect(selectionBar(page)).toBeVisible();
      const dayCount = Number(/(\d+) ảnh đã chọn/.exec((await selectionBar(page).textContent()) ?? "")?.[1]);
      expect(dayCount).toBeGreaterThanOrEqual(5);
      await dayTick.uncheck();
      await expect(selectionBar(page)).toHaveCount(0);

      // Pick four of ours again and delete them.
      const doomed = [names[0], names[1], names[3], names[4]];
      await column.getByRole("checkbox", { name: `Chọn ảnh ${doomed[0]}` }).click();
      for (const name of doomed.slice(1)) await column.getByRole("button", { name: `Chọn ảnh ${name}` }).click();
      await expect(selectionBar(page)).toContainText("4 ảnh đã chọn");
      await selectionBar(page).getByRole("button", { name: "Xoá 4 ảnh" }).click();

      const dialog = page.getByRole("dialog", { name: "Xoá 4 ảnh?" });
      await expect(dialog.getByTestId("patient-image-bulk-thumbs").locator("img")).toHaveCount(4);
      const deleted = page.waitForResponse(
        (res) => res.request().method() === "POST" && new URL(res.url()).pathname === DELETE_MANY,
      );
      await dialog.getByRole("button", { name: "Xoá 4 ảnh" }).click();
      const answer = await deleted;
      expect(answer.status()).toBeLessThan(300);
      const sentIds = (answer.request().postDataJSON() as { ids: string[] }).ids;
      const doomedIds = stored.filter((image) => doomed.includes(image.fileName)).map((image) => image.id);
      expect([...sentIds].sort()).toEqual([...doomedIds].sort());

      await expect(page.locator("[data-sonner-toast]").filter({ hasText: "Đã xoá 4 ảnh" })).toBeVisible();
      await expect(dialog).toBeHidden();
      await expect(selectionBar(page)).toHaveCount(0);
      for (const name of doomed) await expect(cardOf(page, name)).toHaveCount(0);
      await expect(cardOf(page, names[2])).toBeVisible();

      // It is the database talking.
      await page.reload();
      await expect(cardOf(page, names[2])).toBeVisible({ timeout: 15_000 });
      for (const name of doomed) await expect(cardOf(page, name)).toHaveCount(0);
      const left = await storedIds(page, patientId);
      for (const doomedId of doomedIds) expect(left).not.toContain(doomedId);
    } finally {
      await removeLeftovers(page, patientId, stored);
    }
  });

  test("R-1322: sweep a marquee over pictures to tick them, sweep again to add, then delete them", async ({ page }) => {
    await login(page);
    const patientId = await openImageTab(page);
    const id = runId();
    const names = Array.from({ length: 4 }, (_, i) => `boi-${id}-${i + 1}.png`);
    const stored = collectStored(page);

    try {
      await uploadPictures(page, stored, names);
      const column = beforeColumn(page);
      const box = async (name: string) => {
        const rect = await cardOf(page, name).boundingBox();
        if (!rect) throw new Error(`no box for ${name}`);
        return rect;
      };
      /** Presses the mouse inside `from` and lets go inside `to`, in small steps, as a hand would. */
      const sweep = async (from: string, to: string) => {
        const a = await box(from);
        const b = await box(to);
        await page.mouse.move(a.x + a.width * 0.3, a.y + a.height * 0.3);
        await page.mouse.down();
        await page.mouse.move(b.x + b.width * 0.6, b.y + b.height * 0.6, { steps: 12 });
        await expect(column.getByTestId("patient-image-marquee")).toBeVisible();
        await page.mouse.up();
        await expect(column.getByTestId("patient-image-marquee")).toBeHidden();
      };

      // The newest upload is drawn first, so pick a neighbouring pair as they lie on screen.
      const order = await column
        .getByTestId("patient-image-card")
        .locator("img")
        .evaluateAll((imgs) => imgs.map((img) => img.getAttribute("alt") ?? ""));
      const ours = order.filter((name) => names.includes(name));
      expect(ours).toHaveLength(4);

      // Sweep only along a row of ours, so the rectangle never reaches a picture the test did not upload.
      const rows: string[][] = [];
      let rowTop = NaN;
      for (const name of ours) {
        const top = Math.round((await box(name)).y);
        if (top === rowTop) rows[rows.length - 1].push(name);
        else rows.push([name]);
        rowTop = top;
      }
      const [first, second] = rows.length === 1 ? [ours.slice(0, 2), ours.slice(2)] : [rows[0], rows.slice(1).flat()];
      expect(rows.length).toBeLessThanOrEqual(2);

      // A sweep across pictures ticks them all — and opens no viewer.
      await sweep(first[0], first[first.length - 1]);
      await expect(page.locator(".pi-viewer, [data-testid='patient-image-viewer']")).toHaveCount(0);
      await expect(selectionBar(page)).toContainText(`${first.length} ảnh đã chọn`);
      for (const name of first) {
        await expect(column.getByRole("button", { name: `Chọn ảnh ${name}` })).toHaveAttribute("aria-pressed", "true");
      }

      // A second sweep adds to what is ticked; it never drops the first ones.
      await sweep(second[0], second[second.length - 1]);
      await expect(selectionBar(page)).toContainText("4 ảnh đã chọn");
      for (const name of ours) {
        await expect(column.getByRole("button", { name: `Chọn ảnh ${name}` })).toHaveAttribute("aria-pressed", "true");
      }

      // A plain click still ticks (or unticks) one picture.
      await column.getByRole("button", { name: `Chọn ảnh ${ours[3]}` }).click();
      await expect(selectionBar(page)).toContainText("3 ảnh đã chọn");
      const doomed = ours.slice(0, 3);

      await selectionBar(page).getByRole("button", { name: "Xoá 3 ảnh" }).click();
      const dialog = page.getByRole("dialog", { name: "Xoá 3 ảnh?" });
      const deleted = page.waitForResponse(
        (res) => res.request().method() === "POST" && new URL(res.url()).pathname === DELETE_MANY,
      );
      await dialog.getByRole("button", { name: "Xoá 3 ảnh" }).click();
      const answer = await deleted;
      expect(answer.status()).toBeLessThan(300);
      const doomedIds = stored.filter((image) => doomed.includes(image.fileName)).map((image) => image.id);
      expect([...(answer.request().postDataJSON() as { ids: string[] }).ids].sort()).toEqual([...doomedIds].sort());

      // It is the database talking.
      await page.reload();
      await expect(cardOf(page, ours[3])).toBeVisible({ timeout: 15_000 });
      for (const name of doomed) await expect(cardOf(page, name)).toHaveCount(0);
      const left = await storedIds(page, patientId);
      for (const doomedId of doomedIds) expect(left).not.toContain(doomedId);
    } finally {
      await removeLeftovers(page, patientId, stored);
    }
  });

  test("the server deletes all or none, refuses an empty list and another branch's account", async ({ page, browser }) => {
    await login(page);
    const patientId = await openImageTab(page);
    const id = runId();
    const stored = collectStored(page);

    try {
      await uploadPictures(page, stored, [`api-${id}-1.png`, `api-${id}-2.png`]);
      const ids = stored.map((image) => image.id);

      // One unknown id keeps the whole lot.
      const unknown = await call(page, DELETE_MANY, {
        method: "POST",
        branchId: BRANCH_ONE,
        json: { ids: [ids[0], crypto.randomUUID()] },
      });
      expect(unknown.status).toBeGreaterThanOrEqual(400);
      expect(unknown.status).toBeLessThan(500);
      expect(await storedIds(page, patientId)).toEqual(expect.arrayContaining(ids));

      const empty = await call(page, DELETE_MANY, { method: "POST", branchId: BRANCH_ONE, json: { ids: [] } });
      expect(empty.status).toBe(400);

      // An account of branch 2 may not delete branch 1's pictures, not even in a batch.
      const context = await browser.newContext();
      const other = await context.newPage();
      try {
        await login(other, BRANCH2_USER);
        const refused = await call(other, DELETE_MANY, { method: "POST", json: { ids } });
        expect(refused.status).toBe(403);
      } finally {
        await context.close();
      }
      expect(await storedIds(page, patientId)).toEqual(expect.arrayContaining(ids));

      const done = await call(page, DELETE_MANY, { method: "POST", branchId: BRANCH_ONE, json: { ids } });
      expect(done.status).toBeLessThan(300);
      const left = await storedIds(page, patientId);
      for (const each of ids) expect(left).not.toContain(each);
    } finally {
      await removeLeftovers(page, patientId, stored);
    }
  });
});
