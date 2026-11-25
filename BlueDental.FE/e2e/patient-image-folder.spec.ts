import { expect, test, type Locator, type Page, type Response } from "@playwright/test";
import { assertRealApiTraffic, login, runId } from "./fixtures/auth";
import { call } from "./fixtures/timekeepingStaff";

/**
 * F-98 / R-1323: tab "Hình ảnh" — thư mục in each stage column.
 *
 * Login, API, MinIO and PostgreSQL are real and nothing is intercepted. The
 * test makes its own thư mục and pictures and touches nothing else on the
 * record; whatever a failed run leaves behind is deleted again in `finally`.
 */

const BRANCH_ONE = "11111111-1111-1111-1111-111111111111";
const IMAGES_API = "/api/v1/app/patient-images";
const FOLDERS_API = "/api/v1/app/patient-image-folders";

/** A 16×16 PNG — the smallest thing the server will accept as a picture. */
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAAAAAA6mKC9AAAAGUlEQVR42mNgAIL/QIBMkypAqX4YGATuAADA/X+BdAueyAAAAABJRU5ErkJggg==",
  "base64",
);

interface StoredImage {
  id: string;
  fileName: string;
  folderId: string | null;
}

interface StoredFolder {
  id: string;
  name: string;
  imageCount: number;
}

async function openImageTab(page: Page): Promise<string> {
  await page.goto("/patient");
  await assertRealApiTraffic(page, "/api/v1/app/patients");
  await page.locator("tr.ant-table-row .bd-patient-name").first().click();
  await expect(page).toHaveURL(/\/patient\/[0-9a-f-]{36}/);
  const patientId = /\/patient\/([0-9a-f-]{36})/.exec(page.url())?.[1] ?? "";

  const listed = assertRealApiTraffic(page, FOLDERS_API);
  await page.getByRole("link", { name: "Hình ảnh" }).click();
  await expect(page).toHaveURL(/tab=image/);
  await listed;
  return patientId;
}

const beforeColumn = (page: Page): Locator =>
  page.locator('[data-testid="patient-image-stage"][data-stage="before"]');
const cardOf = (page: Page, fileName: string): Locator =>
  beforeColumn(page).getByTestId("patient-image-card").filter({ has: page.locator(`img[alt="${fileName}"]`) });
const tileOf = (page: Page, name: string): Locator =>
  beforeColumn(page).locator(`[data-testid="patient-image-folder"][data-folder-name="${name}"]`);
const selectionBar = (page: Page): Locator => beforeColumn(page).getByTestId("patient-image-selection-bar");
const toast = (page: Page, text: string): Locator => page.locator("[data-sonner-toast]").filter({ hasText: text });

function collectStored(page: Page): StoredImage[] {
  const stored: StoredImage[] = [];
  page.on("response", async (res: Response) => {
    const req = res.request();
    if (req.method() === "POST" && new URL(req.url()).pathname === IMAGES_API && res.ok()) {
      stored.push((await res.json()) as StoredImage);
    }
  });
  return stored;
}

/** "Tải ảnh" of the Trước điều trị column, into whatever it shows; waits for every card. */
async function uploadPictures(
  page: Page,
  stored: StoredImage[],
  names: string[],
  place: string,
  note = "",
): Promise<void> {
  const before = stored.length;
  await beforeColumn(page)
    .getByTestId("patient-image-input")
    .setInputFiles(names.map((name) => ({ name, mimeType: "image/png", buffer: PNG })));
  const dialog = page.getByRole("dialog", { name: `Tải ảnh lên · ${place}` });
  if (note) await dialog.getByRole("textbox").fill(note);
  await dialog.getByRole("button", { name: `Tải lên ${names.length} ảnh` }).click();
  await expect.poll(() => stored.length, { timeout: 60_000 }).toBe(before + names.length);
  for (const name of names) await expect(cardOf(page, name)).toBeVisible({ timeout: 15_000 });
}

async function listFolders(page: Page, patientId: string): Promise<StoredFolder[]> {
  const res = await call<StoredFolder[]>(
    page,
    `${FOLDERS_API}?patientId=${patientId}&clinicBranchId=${BRANCH_ONE}&type=1`,
    { branchId: BRANCH_ONE },
  );
  expect(res.status).toBe(200);
  return res.body;
}

async function listImages(page: Page, patientId: string): Promise<StoredImage[]> {
  const res = await call<{ items: StoredImage[] }>(
    page,
    `${IMAGES_API}?patientId=${patientId}&clinicBranchId=${BRANCH_ONE}&maxResultCount=1000`,
    { branchId: BRANCH_ONE },
  );
  expect(res.status).toBe(200);
  return res.body.items;
}

async function cleanUp(page: Page, patientId: string, images: StoredImage[], prefix: string): Promise<void> {
  if (page.isClosed() || !patientId) return;
  const left = (await listImages(page, patientId)).map((image) => image.id);
  for (const image of images.filter((each) => left.includes(each.id))) {
    await call(page, `${IMAGES_API}/${image.id}`, { method: "DELETE", branchId: BRANCH_ONE });
  }
  for (const folder of (await listFolders(page, patientId)).filter((each) => each.name.startsWith(prefix))) {
    await call(page, `${FOLDERS_API}/${folder.id}`, { method: "DELETE", branchId: BRANCH_ONE });
  }
}

/** The tile's "⋯" shows on hover; opens its menu and picks `item`. */
async function tileMenu(page: Page, name: string, item: string): Promise<void> {
  const tile = tileOf(page, name);
  await tile.hover();
  await tile.getByRole("button", { name: `Tuỳ chọn thư mục ${name}` }).click();
  await page.getByRole("menuitem", { name: item }).click();
}

test.describe("Hình ảnh — thư mục (F-98)", () => {
  test.describe.configure({ timeout: 180_000 });

  test("create, upload into, move in and out, rename, delete — the pictures come back out", async ({ page }) => {
    await login(page);
    const patientId = await openImageTab(page);
    const id = runId();
    const prefix = `TM-${id}`;
    const folderName = `${prefix} Răng cửa`;
    const renamed = `${prefix} X-quang`;
    const inside = [`tm-${id}-1.png`, `tm-${id}-2.png`];
    const loose = `tm-${id}-ngoai.png`;
    const stored = collectStored(page);
    const column = beforeColumn(page);

    try {
      // "Thư mục mới": a blank name is refused before it is sent.
      await column.getByRole("button", { name: "Thư mục mới" }).click();
      let dialog = page.getByRole("dialog", { name: "Thư mục mới" });
      await dialog.getByRole("button", { name: "Lưu" }).click();
      await expect(dialog.getByRole("alert")).toHaveText("Vui lòng nhập tên thư mục");

      // Spaces are folded the way the server keeps the name.
      await dialog.getByLabel("Tên thư mục").fill(`  ${prefix}   Răng cửa `);
      const created = page.waitForResponse(
        (res) => res.request().method() === "POST" && new URL(res.url()).pathname === FOLDERS_API,
      );
      await dialog.getByRole("button", { name: "Lưu" }).click();
      expect((await created).status()).toBe(200);
      await expect(toast(page, `Đã tạo thư mục "${folderName}"`)).toBeVisible();
      await expect(dialog).toBeHidden();

      // An empty thư mục is plain yellow: no picture peeking out.
      const tile = tileOf(page, folderName);
      await expect(tile).toContainText("Trống");
      await expect(tile.locator(".pi-folder-cover")).toHaveCount(0);

      // The same name twice in a column is refused by the server, and the dialog stays.
      await column.getByRole("button", { name: "Thư mục mới" }).click();
      dialog = page.getByRole("dialog", { name: "Thư mục mới" });
      await dialog.getByLabel("Tên thư mục").fill(folderName);
      await dialog.getByRole("button", { name: "Lưu" }).click();
      await expect(toast(page, "Giai đoạn này đã có thư mục cùng tên.")).toBeVisible();
      await expect(dialog).toBeVisible();
      await dialog.getByRole("button", { name: "Huỷ" }).click();
      await expect(tileOf(page, folderName)).toHaveCount(1);

      // Into the thư mục: its own head, empty text, and the upload files into it.
      await tile.getByRole("button", { name: `Mở thư mục ${folderName}` }).click();
      const head = column.getByTestId("patient-image-folder-head");
      await expect(head).toContainText(folderName);
      await expect(head).toContainText("Trước điều trị · 0 ảnh");
      await expect(column.getByTestId("patient-image-empty")).toHaveText("Thư mục chưa có ảnh");
      await expect(column.getByTestId("patient-image-folders")).toHaveCount(0);
      await uploadPictures(page, stored, inside, `Trước điều trị / ${folderName}`);
      await expect(head).toContainText("Trước điều trị · 2 ảnh");

      // Back at the root: the thư mục counts them and shows the newest; they are not loose in the column.
      await head.getByRole("button", { name: "Quay lại Trước điều trị" }).click();
      await expect(tile).toContainText("2 ảnh");
      await expect(tile.locator("img.pi-folder-cover")).toBeVisible();
      for (const name of inside) await expect(cardOf(page, name)).toHaveCount(0);

      // A loose picture, ticked and moved in with "Chuyển vào thư mục".
      await uploadPictures(page, stored, [loose], "Trước điều trị");
      await column.getByRole("checkbox", { name: `Chọn ảnh ${loose}` }).click();
      await expect(selectionBar(page)).toContainText("1 ảnh đã chọn");
      await selectionBar(page).getByRole("button", { name: "Chuyển vào thư mục" }).click();
      const movedIn = page.waitForResponse(
        (res) => res.request().method() === "POST" && new URL(res.url()).pathname === `${IMAGES_API}/move`,
      );
      await page.getByRole("menuitem", { name: folderName }).click();
      expect((await movedIn).status()).toBeLessThan(300);
      await expect(toast(page, `Đã chuyển 1 ảnh vào "${folderName}"`)).toBeVisible();
      await expect(selectionBar(page)).toHaveCount(0);
      await expect(cardOf(page, loose)).toHaveCount(0);
      await expect(tile).toContainText("3 ảnh");

      // Rename.
      await tileMenu(page, folderName, "Đổi tên");
      dialog = page.getByRole("dialog", { name: "Đổi tên thư mục" });
      await expect(dialog.getByLabel("Tên thư mục")).toHaveValue(folderName);
      await dialog.getByLabel("Tên thư mục").fill(renamed);
      await dialog.getByRole("button", { name: "Lưu" }).click();
      await expect(toast(page, `Đã đổi tên thư mục thành "${renamed}"`)).toBeVisible();
      await expect(tileOf(page, renamed)).toContainText("3 ảnh");
      await expect(tileOf(page, folderName)).toHaveCount(0);

      // Inside again: one picture back out with "Đưa ra ngoài thư mục".
      await tileOf(page, renamed).getByRole("button", { name: `Mở thư mục ${renamed}` }).click();
      await expect(cardOf(page, loose)).toBeVisible();
      await column.getByRole("checkbox", { name: `Chọn ảnh ${loose}` }).click();
      await selectionBar(page).getByRole("button", { name: "Chuyển vào thư mục" }).click();
      await page.getByRole("menuitem", { name: "Đưa ra ngoài thư mục" }).click();
      await expect(toast(page, "Đã đưa 1 ảnh ra ngoài thư mục")).toBeVisible();
      await expect(cardOf(page, loose)).toHaveCount(0);
      await column.getByRole("button", { name: "Quay lại Trước điều trị" }).click();
      await expect(cardOf(page, loose)).toBeVisible();
      await expect(tileOf(page, renamed)).toContainText("2 ảnh");

      // The database agrees.
      const [folder] = (await listFolders(page, patientId)).filter((each) => each.name === renamed);
      expect(folder?.imageCount).toBe(2);
      const images = await listImages(page, patientId);
      const ours = (name: string) => images.find((image) => image.fileName === name);
      for (const name of inside) expect(ours(name)?.folderId).toBe(folder?.id);
      expect(ours(loose)?.folderId).toBeNull();

      // Reload: still there.
      await page.reload();
      await expect(tileOf(page, renamed)).toContainText("2 ảnh", { timeout: 15_000 });
      await expect(cardOf(page, loose)).toBeVisible();
      for (const name of inside) await expect(cardOf(page, name)).toHaveCount(0);

      // Delete the thư mục: its pictures go back into the column, none is deleted.
      await tileMenu(page, renamed, "Xoá thư mục");
      dialog = page.getByRole("dialog", { name: `Xoá thư mục "${renamed}"?` });
      await expect(dialog).toContainText("2 ảnh trong thư mục sẽ được đưa ra ngoài, không ảnh nào bị xoá.");
      const removed = page.waitForResponse(
        (res) => res.request().method() === "DELETE" && new URL(res.url()).pathname.startsWith(`${FOLDERS_API}/`),
      );
      await dialog.getByRole("button", { name: "Xoá" }).click();
      expect((await removed).status()).toBeLessThan(300);
      await expect(toast(page, `Đã xoá thư mục "${renamed}"`)).toBeVisible();
      await expect(tileOf(page, renamed)).toHaveCount(0);
      for (const name of [...inside, loose]) await expect(cardOf(page, name)).toBeVisible();

      await page.reload();
      for (const name of [...inside, loose]) await expect(cardOf(page, name)).toBeVisible({ timeout: 15_000 });
      expect((await listFolders(page, patientId)).some((each) => each.name.startsWith(prefix))).toBe(false);
      const after = await listImages(page, patientId);
      for (const name of [...inside, loose]) expect(after.find((image) => image.fileName === name)?.folderId).toBeNull();
    } finally {
      await cleanUp(page, patientId, stored, prefix);
    }
  });

  test("the server refuses a move into another stage's thư mục, and a root search reaches into thư mục", async ({
    page,
  }) => {
    await login(page);
    const patientId = await openImageTab(page);
    const id = runId();
    const prefix = `TM-${id}`;
    const name = `tm-${id}-tim.png`;
    const note = `Ghi chu tim ${id}`;
    const stored = collectStored(page);

    try {
      // A thư mục of "Trong điều trị" (type 2), made through the API.
      const during = await call<StoredFolder>(page, FOLDERS_API, {
        method: "POST",
        branchId: BRANCH_ONE,
        json: { patientId, clinicBranchId: BRANCH_ONE, type: 2, name: `${prefix} Trong` },
      });
      expect(during.status).toBe(200);
      const before = await call<StoredFolder>(page, FOLDERS_API, {
        method: "POST",
        branchId: BRANCH_ONE,
        json: { patientId, clinicBranchId: BRANCH_ONE, type: 1, name: `${prefix} Trước` },
      });
      expect(before.status).toBe(200);

      await page.reload();
      await uploadPictures(page, stored, [name], "Trước điều trị", note);
      const picture = stored.find((image) => image.fileName === name);
      expect(picture).toBeDefined();

      // A "Trước điều trị" picture cannot go into a "Trong điều trị" thư mục.
      const refused = await call<{ error?: { code?: string } }>(page, `${IMAGES_API}/move`, {
        method: "POST",
        branchId: BRANCH_ONE,
        json: { ids: [picture?.id], folderId: during.body.id },
      });
      expect(refused.status).toBe(403);
      expect(refused.body.error?.code).toBe("BlueDental:Patient:0039");

      // Into its own stage's thư mục it goes, and is no longer loose in the column.
      const moved = await call(page, `${IMAGES_API}/move`, {
        method: "POST",
        branchId: BRANCH_ONE,
        json: { ids: [picture?.id], folderId: before.body.id },
      });
      expect(moved.status).toBeLessThan(300);
      await page.reload();
      await expect(tileOf(page, `${prefix} Trước`)).toContainText("1 ảnh", { timeout: 15_000 });
      await expect(cardOf(page, name)).toHaveCount(0);

      // A search at the column's root reaches into the thư mục; the folder grid steps aside.
      await page.getByRole("textbox", { name: "Tìm ảnh theo ghi chú" }).fill(note);
      await expect(cardOf(page, name)).toBeVisible({ timeout: 15_000 });
      await expect(beforeColumn(page).getByTestId("patient-image-folders")).toHaveCount(0);
    } finally {
      await cleanUp(page, patientId, stored, prefix);
      if (!page.isClosed() && patientId) {
        const res = await call<StoredFolder[]>(
          page,
          `${FOLDERS_API}?patientId=${patientId}&clinicBranchId=${BRANCH_ONE}&type=2`,
          { branchId: BRANCH_ONE },
        );
        for (const folder of (res.body ?? []).filter((each) => each.name.startsWith(prefix))) {
          await call(page, `${FOLDERS_API}/${folder.id}`, { method: "DELETE", branchId: BRANCH_ONE });
        }
      }
    }
  });
});
