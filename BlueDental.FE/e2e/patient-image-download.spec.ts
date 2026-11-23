import { readFile } from "node:fs/promises";
import { expect, test, type Download, type Locator, type Page, type Response } from "@playwright/test";
import { unzipSync } from "fflate";
import { assertRealApiTraffic, login, runId } from "./fixtures/auth";
import { call } from "./fixtures/timekeepingStaff";

/**
 * Tab "Hình ảnh" — "Tải xuống" on the selection: one ticked picture is saved
 * as itself, two or more as one .zip holding every one of them.
 *
 * Login, API, MinIO and PostgreSQL are real and nothing is intercepted. The
 * test uploads its own pictures and deletes them again in `finally`.
 */

const BRANCH_ONE = "11111111-1111-1111-1111-111111111111";
const IMAGES_API = "/api/v1/app/patient-images";

/** A 16×16 PNG — the smallest thing the server will accept as a picture. */
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAAAAAA6mKC9AAAAGUlEQVR42mNgAIL/QIBMkypAqX4YGATuAADA/X+BdAueyAAAAABJRU5ErkJggg==",
  "base64",
);

interface UploadedImage {
  id: string;
  fileName: string;
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

async function uploadPictures(page: Page, stored: UploadedImage[], names: string[]): Promise<void> {
  await beforeColumn(page)
    .getByTestId("patient-image-input")
    .setInputFiles(names.map((name) => ({ name, mimeType: "image/png", buffer: PNG })));
  const dialog = page.getByRole("dialog", { name: "Tải ảnh lên · Trước điều trị" });
  await dialog.getByRole("button", { name: `Tải lên ${names.length} ảnh` }).click();
  await expect.poll(() => stored.length, { timeout: 60_000 }).toBe(names.length);
  for (const name of names) await expect(cardOf(page, name)).toBeVisible({ timeout: 15_000 });
}

async function savedBytes(download: Download): Promise<Buffer> {
  const path = await download.path();
  return readFile(path);
}

async function removeUploaded(page: Page, images: UploadedImage[]): Promise<void> {
  if (page.isClosed()) return;
  for (const image of images) {
    await call(page, `${IMAGES_API}/${image.id}`, { method: "DELETE", branchId: BRANCH_ONE });
  }
}

test.describe("Hình ảnh — tải xuống ảnh đã chọn", () => {
  test.describe.configure({ timeout: 120_000 });

  test("one ticked picture downloads as itself, several as one zip of them all", async ({ page }) => {
    await login(page);
    await openImageTab(page);
    const id = runId();
    const names = Array.from({ length: 3 }, (_, i) => `tai-${id}-${i + 1}.png`);
    const stored = collectStored(page);

    try {
      await uploadPictures(page, stored, names);
      const column = beforeColumn(page);

      // One picture: the file itself, under its own name, the bytes that were uploaded.
      await column.getByRole("checkbox", { name: `Chọn ảnh ${names[0]}` }).click();
      await expect(selectionBar(page)).toContainText("1 ảnh đã chọn");
      const single = page.waitForEvent("download");
      await selectionBar(page).getByRole("button", { name: "Tải xuống 1 ảnh" }).click();
      const one = await single;
      expect(one.suggestedFilename()).toBe(names[0]);
      expect((await savedBytes(one)).equals(PNG)).toBe(true);

      // Downloading leaves the selection as it was.
      await expect(selectionBar(page)).toContainText("1 ảnh đã chọn");

      // Three pictures: one zip, every picture in it by name, bytes intact.
      for (const name of names.slice(1)) await column.getByRole("button", { name: `Chọn ảnh ${name}` }).click();
      await expect(selectionBar(page)).toContainText("3 ảnh đã chọn");
      const zipped = page.waitForEvent("download");
      await selectionBar(page).getByRole("button", { name: "Tải xuống 3 ảnh" }).click();
      const zip = await zipped;
      expect(zip.suggestedFilename()).toMatch(/^hinh-anh-\d{8}-\d{6}\.zip$/);

      const entries = unzipSync(new Uint8Array(await savedBytes(zip)));
      expect(Object.keys(entries).sort()).toEqual([...names].sort());
      // The bytes came back from MinIO through the API, as uploaded.
      for (const name of names) expect(Buffer.from(entries[name]).equals(PNG)).toBe(true);
    } finally {
      await removeUploaded(page, stored);
    }
  });
});
