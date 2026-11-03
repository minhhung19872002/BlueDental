import { expect, test, type Locator, type Page, type Request, type Response } from "@playwright/test";
import { assertRealApiTraffic, login, runId } from "./fixtures/auth";
import { call } from "./fixtures/timekeepingStaff";

/**
 * "Tải ảnh" on tab "Hình ảnh" with no cap on how many pictures one pick sends
 * (owner, 2026-10-28 — the reference stops at ten) and a 20 MB check per file,
 * the server's own ceiling. The files go up one at a time, the button counts
 * them ("Đang tải 3/12"), and the gallery is fetched again once, at the end.
 * See docs/clone/pages/patient-detail.md, Tab 5.
 *
 * Login, API, MinIO and PostgreSQL are real and nothing is intercepted; the
 * failing upload is the server itself turning down an empty file. Every
 * picture uploaded here is deleted again.
 */

const BRANCH_ONE = "11111111-1111-1111-1111-111111111111";
const IMAGES_API = "/api/v1/app/patient-images";
const MEGABYTE = 1024 * 1024;

/** A 16×16 PNG — the smallest thing the server will accept as a picture. */
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAAAAAA6mKC9AAAAGUlEQVR42mNgAIL/QIBMkypAqX4YGATuAADA/X+BdAueyAAAAABJRU5ErkJggg==",
  "base64",
);

interface UploadedImage {
  id: string;
  fileName: string;
}

declare global {
  interface Window {
    uploadLabels?: string[];
  }
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

function card(page: Page, fileName: string): Locator {
  return page.getByTestId("patient-image-card").filter({ has: page.getByRole("button", { name: `Xem ảnh ${fileName}` }) });
}

/** The "Trước điều trị" column, where these uploads are sent from. */
function beforeColumn(page: Page): Locator {
  return page.locator('[data-testid="patient-image-stage"][data-stage="before"]');
}

/** The preview a pick opens: "Tải lên n ảnh" sends what it shows. */
function uploadDialog(page: Page): Locator {
  return page.getByRole("dialog", { name: "Tải ảnh lên · Trước điều trị" });
}

async function confirmUpload(page: Page, count: number): Promise<void> {
  const dialog = uploadDialog(page);
  await expect(dialog.getByTestId("picked-image")).toHaveCount(count);
  await dialog.getByRole("button", { name: `Tải lên ${count} ảnh` }).click();
}

function toast(page: Page, title: string): Locator {
  return page.locator("[data-sonner-toast]").filter({ hasText: title });
}

function isUpload(req: Request): boolean {
  return req.method() === "POST" && new URL(req.url()).pathname === IMAGES_API;
}

/** The gallery's list request — not the pictures' own content requests. */
function isGalleryFetch(req: Request): boolean {
  return req.method() === "GET" && new URL(req.url()).pathname === IMAGES_API;
}

/** Keeps every picture the server stores, so the test can delete them all. */
function collectStored(page: Page): UploadedImage[] {
  const stored: UploadedImage[] = [];
  page.on("response", async (res: Response) => {
    if (isUpload(res.request()) && res.ok()) stored.push((await res.json()) as UploadedImage);
  });
  return stored;
}

/** Writes down every label "Tải ảnh" wears while it works. */
async function recordUploadLabels(page: Page): Promise<void> {
  await beforeColumn(page).getByRole("button", { name: "Tải ảnh" }).evaluate((button) => {
    window.uploadLabels = [];
    new MutationObserver(() => window.uploadLabels?.push(button.textContent ?? "")).observe(button, {
      subtree: true,
      childList: true,
      characterData: true,
    });
  });
}

/** A 1600×1600 PNG of noise: past the old 5 MB check, which shrinking cannot help. */
async function heavyPng(page: Page): Promise<Buffer> {
  const base64 = await page.evaluate(() => {
    const side = 1600;
    const canvas = document.createElement("canvas");
    canvas.width = side;
    canvas.height = side;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("no 2d context");
    const pixels = context.createImageData(side, side);
    for (let i = 0; i < pixels.data.length; i += 4) {
      pixels.data[i] = Math.random() * 256;
      pixels.data[i + 1] = Math.random() * 256;
      pixels.data[i + 2] = Math.random() * 256;
      pixels.data[i + 3] = 255;
    }
    context.putImageData(pixels, 0, 0);
    return canvas.toDataURL("image/png").split(",")[1] ?? "";
  });
  return Buffer.from(base64, "base64");
}

async function removeImages(page: Page, images: UploadedImage[]): Promise<void> {
  for (const image of images) {
    const res = await call(page, `${IMAGES_API}/${image.id}`, { method: "DELETE", branchId: BRANCH_ONE });
    expect(res.status).toBeLessThan(300);
  }
}

test.describe("Tải ảnh — không giới hạn số ảnh", () => {
  test.describe.configure({ timeout: 120_000 });

  test.beforeEach(async ({ page }) => {
    await login(page);
    await openImageTab(page);
  });

  test("twelve pictures in one pick all go up, counted on the button, and the gallery is fetched once", async ({ page }) => {
    const id = runId();
    const names = Array.from({ length: 12 }, (_, i) => `lo-${id}-${String(i + 1).padStart(2, "0")}.png`);
    const stored = collectStored(page);
    const traffic: Request[] = [];
    const uploadSteps: string[] = [];
    page.on("request", (req) => {
      if (isUpload(req) || isGalleryFetch(req)) traffic.push(req);
      if (isUpload(req)) uploadSteps.push("sent");
    });
    page.on("response", (res) => {
      if (isUpload(res.request())) uploadSteps.push("answered");
    });
    await recordUploadLabels(page);

    try {
      await beforeColumn(page)
        .getByTestId("patient-image-input")
        .setInputFiles(names.map((name) => ({ name, mimeType: "image/png", buffer: PNG })));
      expect(traffic.filter(isUpload)).toHaveLength(0);
      await confirmUpload(page, 12);

      await expect.poll(() => stored.length, { timeout: 60_000 }).toBe(12);
      await expect(uploadDialog(page)).toBeHidden();
      await expect(beforeColumn(page).getByRole("button", { name: "Tải ảnh" })).toBeEnabled();
      for (const name of names) await expect(card(page, name)).toBeVisible({ timeout: 15_000 });

      // The button counted its way through the pick, then went back to "Tải ảnh".
      const labels = await page.evaluate(() => window.uploadLabels ?? []);
      expect(labels).toContain("Đang tải 1/12");
      expect(labels).toContain("Đang tải 12/12");
      expect(labels.at(-1)).toBe("Tải ảnh");

      // One file at a time — each answered before the next is sent — and no refetch until the last is in.
      expect(uploadSteps).toEqual(names.flatMap(() => ["sent", "answered"]));
      expect(stored.map((image) => image.fileName).sort()).toEqual(names);
      const uploads = traffic.filter(isUpload);
      const first = traffic.indexOf(uploads[0]);
      const last = traffic.indexOf(uploads[11]);
      expect(traffic.slice(first, last).filter(isGalleryFetch)).toHaveLength(0);
      expect(traffic.slice(last).filter(isGalleryFetch).length).toBeGreaterThan(0);

      // It is the database talking: a day shows its cards by upload order, so the pick comes back as picked.
      await page.reload();
      for (const name of names) await expect(card(page, name)).toBeVisible({ timeout: 15_000 });
      const shown = await beforeColumn(page)
        .getByTestId("patient-image-card")
        .locator("img")
        .evaluateAll((imgs) => imgs.map((img) => (img as HTMLImageElement).alt));
      const shownNames = shown.filter((name) => names.includes(name));
      expect(shownNames).toEqual(names);
    } finally {
      await removeImages(page, stored);
    }
  });

  test("a picture over 5 MB goes up; one over 20 MB and the wrong types are turned away by name", async ({ page }) => {
    const id = runId();
    const heavy = `nang-${id}.png`;
    const tooBig = `qua-lon-${id}.png`;
    const notImages = ["a", "b", "c", "d"].map((letter) => `ghi-chu-${letter}-${id}.txt`);
    const stored = collectStored(page);

    const heavyFile = await heavyPng(page);
    expect(heavyFile.length).toBeGreaterThan(5 * MEGABYTE);
    expect(heavyFile.length).toBeLessThan(20 * MEGABYTE);

    try {
      await beforeColumn(page).getByTestId("patient-image-input").setInputFiles([
        { name: heavy, mimeType: "image/png", buffer: heavyFile },
        { name: tooBig, mimeType: "image/png", buffer: Buffer.alloc(21 * MEGABYTE) },
        ...notImages.map((name) => ({ name, mimeType: "text/plain", buffer: Buffer.from("x") })),
      ]);

      // Turned away as they are picked — one toast per reason, naming the first
      // three files and counting the rest — so only the heavy one is previewed.
      await expect(toast(page, "Ảnh phải nhỏ hơn 20 MB")).toContainText(tooBig);
      await expect(toast(page, "Chỉ chấp nhận ảnh PNG, JPG hoặc WEBP")).toContainText(
        `${notImages.slice(0, 3).join(", ")} và 1 tệp khác`,
      );
      await confirmUpload(page, 1);

      await expect.poll(() => stored.length, { timeout: 30_000 }).toBe(1);
      expect(stored[0].fileName).toBe(heavy);
      await expect(card(page, heavy)).toBeVisible({ timeout: 15_000 });
      await expect(card(page, tooBig)).toHaveCount(0);
    } finally {
      await removeImages(page, stored);
    }
  });

  test("when the server turns a file down, the rest stop and the toast says how far it got", async ({ page }) => {
    const id = runId();
    const sent = `truoc-loi-${id}.png`;
    const empty = `rong-${id}.png`;
    const unsent = `sau-loi-${id}.png`;
    const stored = collectStored(page);
    const uploads: string[] = [];
    page.on("request", (req) => {
      if (isUpload(req)) uploads.push(req.url());
    });

    try {
      await beforeColumn(page).getByTestId("patient-image-input").setInputFiles([
        { name: sent, mimeType: "image/png", buffer: PNG },
        { name: empty, mimeType: "image/png", buffer: Buffer.alloc(0) },
        { name: unsent, mimeType: "image/png", buffer: PNG },
      ]);
      await confirmUpload(page, 3);

      await expect(toast(page, `Lỗi khi tải ${empty} — đã tải lên 1/3 ảnh`)).toBeVisible({ timeout: 15_000 });
      // The preview stays with the two that did not go up, ready to be sent again.
      await expect(uploadDialog(page).getByTestId("picked-image")).toHaveCount(2);
      await uploadDialog(page).getByRole("button", { name: "Hủy" }).click();
      await expect(uploadDialog(page)).toBeHidden();
      await expect(beforeColumn(page).getByRole("button", { name: "Tải ảnh" })).toBeEnabled();
      expect(uploads).toHaveLength(2);
      expect(stored.map((image) => image.fileName)).toEqual([sent]);

      // What made it up is in the gallery, refreshed without a reload.
      await expect(card(page, sent)).toBeVisible({ timeout: 15_000 });
      await expect(card(page, unsent)).toHaveCount(0);
    } finally {
      await removeImages(page, stored);
    }
  });
});
