import { expect, test, type Page } from "@playwright/test";
import { BRANCH2_USER, assertRealApiTraffic, login } from "./fixtures/auth";

/**
 * Feature: "Lược đồ phẫu thuật/thủ thuật" on Phiếu phẫu thuật/thủ thuật — the
 * doctor draws the operation in a dialog, the cell shows the picture, and the
 * picture is kept with the sheet (draw, edit, delete).
 *
 * Real stack throughout: the picture is uploaded to blob storage when the sheet
 * is saved, read back through the API after a reload, and dropped from storage
 * once the sheet stops linking to it. Nothing is intercepted.
 */

const FORM = "Phiếu phẫu thuật/thủ thuật";
const DRAWING_FIELD = "procedure-record.diagram";
const SAVED_LINK = /^\/api\/v1\/app\/patient-medical-records\/[0-9a-f-]{36}\/drawings\/[0-9a-f-]{36}$/;

function sheet(page: Page) {
  return page.frameLocator(".mr-doc-frame");
}

function drawingCell(page: Page) {
  return sheet(page).locator(`[data-medical-record-field="${DRAWING_FIELD}"]`);
}

/** The picture's source as the sheet holds it, or "" when nothing is drawn. */
async function drawingSource(page: Page): Promise<string> {
  return (await drawingCell(page).getAttribute("data-drawing-src")) ?? "";
}

/** Opens a patient's Bệnh án and adds a fresh copy of the form; returns its id. */
async function openNewSheet(page: Page): Promise<string> {
  await page.goto("/patient");
  await assertRealApiTraffic(page, "/api/v1/app/patients");
  await page.locator(".bd-patient-tablecard tbody tr.ant-table-row .bd-patient-name").first().click();
  await expect(page).toHaveURL(/\/patient\/[0-9a-f-]{36}/);
  // The record settles its `?branch=` first; a click before that is lost.
  await expect(async () => {
    await page.getByRole("button", { name: /(^|\s)Bệnh án$/ }).click();
    await expect(page).toHaveURL(/view=medical-record/, { timeout: 2_000 });
  }).toPass();

  const added = page.waitForResponse(
    (res) => res.url().endsWith("/api/v1/app/patient-medical-records") && res.request().method() === "POST",
  );
  await page.locator(".pd-medical-form", { hasText: FORM }).getByRole("button", { name: "Thêm" }).click();
  const response = await added;
  expect(response.ok()).toBeTruthy();
  await expect(drawingCell(page)).toBeAttached();
  return ((await response.json()) as { id: string }).id;
}

/**
 * Reloads, then opens the copy this test added — the newest card under the
 * form; after a reload the record opens on its first sheet.
 */
async function reopen(page: Page) {
  await page.reload();
  await page.locator(".pd-medical-form", { hasText: FORM }).locator(".pd-sheet-card").last().locator(".pd-sheet-open").click();
  await expect(drawingCell(page)).toBeAttached();
}

/** Drags a stroke across the drawing page, from and to fractions of its size. */
async function drag(page: Page, from: [number, number], to: [number, number]) {
  const area = page.getByRole("img", { name: "Vùng vẽ lược đồ" });
  const box = await area.boundingBox();
  if (!box) throw new Error("drawing page is not on screen");
  const at = ([x, y]: [number, number]) => [box.x + box.width * x, box.y + box.height * y] as const;

  await page.mouse.move(...at(from));
  await page.mouse.down();
  for (let step = 1; step <= 8; step += 1) {
    const t = step / 8;
    await page.mouse.move(
      box.x + box.width * (from[0] + (to[0] - from[0]) * t),
      box.y + box.height * (from[1] + (to[1] - from[1]) * t),
    );
  }
  await page.mouse.up();
}

async function save(page: Page) {
  const saved = page.waitForResponse(
    (res) => /\/patient-medical-records\/[0-9a-f-]{36}$/.test(res.url()) && res.request().method() === "PUT",
  );
  await page.locator(".pd-medical-bar").getByRole("button", { name: "Lưu" }).click();
  expect((await saved).ok()).toBeTruthy();
  await expect(page.getByText("Đã lưu phiếu bệnh án").first()).toBeVisible();
}

/** Whether the picture in the cell actually loaded — through the real GET, cookie and all. */
async function pictureLoaded(page: Page): Promise<boolean> {
  return drawingCell(page)
    .locator("img")
    .evaluate(async (img: HTMLImageElement) => {
      await img.decode().catch(() => undefined);
      return img.complete && img.naturalWidth > 0;
    });
}

async function statusOf(page: Page, url: string): Promise<number> {
  return (await page.request.get(url)).status();
}

test.describe("Bệnh án — lược đồ phẫu thuật/thủ thuật", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("a drawing is made, kept with the sheet, edited and deleted", async ({ page, browser }) => {
    test.slow();
    const sheetId = await openNewSheet(page);

    // Empty cell: only the button to start drawing.
    await expect(sheet(page).getByRole("button", { name: "Vẽ lược đồ" })).toBeVisible();
    await expect(drawingCell(page).locator("img")).toHaveCount(0);

    // Draw: a pen stroke, then an arrow with the shape tool.
    await sheet(page).getByRole("button", { name: "Vẽ lược đồ" }).click();
    const dialog = page.getByRole("dialog", { name: "Vẽ lược đồ phẫu thuật/thủ thuật" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Áp dụng" })).toBeDisabled();
    await expect(dialog.getByRole("button", { name: "Hoàn tác" })).toBeDisabled();

    await drag(page, [0.2, 0.3], [0.7, 0.6]);
    await dialog.getByRole("button", { name: "Hình", exact: true }).click();
    await drag(page, [0.3, 0.8], [0.8, 0.2]);
    await expect(dialog.getByRole("button", { name: "Hoàn tác" })).toBeEnabled();
    await dialog.getByRole("button", { name: "Áp dụng" }).click();
    await expect(dialog).toBeHidden();

    // On the sheet, not yet stored: the picture is still the PNG itself.
    expect(await drawingSource(page)).toMatch(/^data:image\/png;base64,/);
    await expect(sheet(page).getByRole("button", { name: "Sửa bản vẽ" })).toBeVisible();

    // Saving uploads it and the sheet links to it.
    const uploaded = page.waitForResponse(
      (res) => res.url().includes(`/patient-medical-records/${sheetId}/drawings`) && res.request().method() === "POST",
    );
    await save(page);
    expect((await uploaded).ok()).toBeTruthy();

    // Persisted: after a reload the sheet links to the stored picture and it loads.
    await reopen(page);
    await expect(drawingCell(page).locator("img")).toBeAttached();
    const first = await drawingSource(page);
    expect(first).toMatch(SAVED_LINK);
    expect(first).toContain(sheetId);
    expect(await pictureLoaded(page)).toBe(true);
    const served = await page.request.get(first);
    expect(served.status()).toBe(200);
    expect(served.headers()["content-type"]).toContain("image/png");

    // Branch isolation: a user of the other branch cannot open it.
    const other = await browser.newContext();
    const otherPage = await other.newPage();
    await login(otherPage, BRANCH2_USER);
    expect(await statusOf(otherPage, first)).toBe(404);
    await other.close();

    // Edit: the dialog opens over the current picture; a new stroke is a new drawing.
    await sheet(page).getByRole("button", { name: "Sửa bản vẽ" }).click();
    await expect(dialog).toBeVisible();
    await expect(dialog.locator(".ant-spin-spinning")).toHaveCount(0);
    await dialog.getByRole("button", { name: "Tẩy", exact: true }).click();
    await drag(page, [0.1, 0.1], [0.9, 0.9]);
    await dialog.getByRole("button", { name: "Bút", exact: true }).click();
    await drag(page, [0.1, 0.9], [0.9, 0.1]);
    await dialog.getByRole("button", { name: "Áp dụng" }).click();
    await save(page);
    await reopen(page);
    await expect(drawingCell(page).locator("img")).toBeAttached();
    const second = await drawingSource(page);
    expect(second).toMatch(SAVED_LINK);
    expect(second).not.toBe(first);
    expect(await pictureLoaded(page)).toBe(true);
    // The replaced picture is dropped from storage.
    await expect.poll(() => statusOf(page, first)).toBe(404);

    // Delete: asked first, gone from the cell, and gone for good once saved.
    await sheet(page).getByRole("button", { name: "Xoá" }).click();
    const confirm = page.getByRole("dialog", { name: "Xác nhận xoá bản vẽ" });
    await expect(confirm).toBeVisible();
    await confirm.getByRole("button", { name: "Xoá" }).click();
    await expect(drawingCell(page).locator("img")).toHaveCount(0);
    await save(page);
    await reopen(page);
    await expect(drawingCell(page).locator("img")).toHaveCount(0);
    await expect(sheet(page).getByRole("button", { name: "Vẽ lược đồ" })).toBeVisible();
    await expect.poll(() => statusOf(page, second)).toBe(404);

    // Tidy up the copy this test added.
    const removed = await page.evaluate(async (id: string) => {
      const xsrf = document.cookie
        .split("; ")
        .find((c) => c.startsWith("XSRF-TOKEN="))
        ?.substring("XSRF-TOKEN=".length);
      const res = await fetch(`/api/v1/app/patient-medical-records/${id}`, {
        method: "DELETE",
        credentials: "include",
        headers: xsrf ? { RequestVerificationToken: decodeURIComponent(xsrf) } : {},
      });
      return res.status;
    }, sheetId);
    expect(removed).toBe(204);
  });

  test("only a PNG is accepted as a drawing", async ({ page }) => {
    const sheetId = await openNewSheet(page);

    const refused = await page.evaluate(async (id: string) => {
      const xsrf = document.cookie
        .split("; ")
        .find((c) => c.startsWith("XSRF-TOKEN="))
        ?.substring("XSRF-TOKEN=".length);
      const form = new FormData();
      // Claims to be a PNG; is not one.
      form.append("file", new Blob(["<svg onload=alert(1)></svg>"], { type: "image/png" }), "x.png");
      const res = await fetch(`/api/v1/app/patient-medical-records/${id}/drawings`, {
        method: "POST",
        credentials: "include",
        headers: xsrf ? { RequestVerificationToken: decodeURIComponent(xsrf) } : {},
        body: form,
      });
      const body: { error?: { code?: string } } = await res.json();
      await fetch(`/api/v1/app/patient-medical-records/${id}`, {
        method: "DELETE",
        credentials: "include",
        headers: xsrf ? { RequestVerificationToken: decodeURIComponent(xsrf) } : {},
      });
      return { status: res.status, code: body.error?.code };
    }, sheetId);

    expect(refused.status).toBeGreaterThanOrEqual(400);
    expect(refused.code).toBe("BlueDental:Patient:0024");
  });

  test("a signed-out request cannot read a drawing", async ({ playwright, baseURL }) => {
    const anonymous = await playwright.request.newContext({ baseURL });
    const status = (
      await anonymous.get(`/api/v1/app/patient-medical-records/${crypto.randomUUID()}/drawings/${crypto.randomUUID()}`)
    ).status();
    expect(status).toBe(401);
    await anonymous.dispose();
  });
});
