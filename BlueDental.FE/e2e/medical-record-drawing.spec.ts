import { expect, test, type Locator, type Page } from "@playwright/test";
import { BRANCH2_USER, login } from "./fixtures/auth";
import { cancelSheet, openRecordWithSet } from "./fixtures/medicalRecordSet";

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
  await openRecordWithSet(page);

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

/** How many pixels of the drawing page carry ink. */
async function inkOn(page: Page): Promise<number> {
  return page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>(".sketch-canvas:not(.sketch-canvas--input)");
    const data = canvas?.getContext("2d")?.getImageData(0, 0, canvas.width, canvas.height).data;
    let count = 0;
    if (data) for (let at = 3; at < data.length; at += 4) if (data[at]) count += 1;
    return count;
  });
}

/** The colour at a spot of the drawing page, given as fractions of its size; "" when bare. */
async function colourAt(page: Page, x: number, y: number): Promise<string> {
  return page.evaluate(
    ([fx, fy]) => {
      const canvas = document.querySelector<HTMLCanvasElement>(".sketch-canvas:not(.sketch-canvas--input)");
      const ctx = canvas?.getContext("2d");
      if (!canvas || !ctx) return "";
      const [r, g, b, a] = ctx.getImageData(Math.round(canvas.width * fx), Math.round(canvas.height * fy), 1, 1).data;
      return a ? `${r},${g},${b}` : "";
    },
    [x, y],
  );
}

async function inkAt(page: Page, x: number, y: number): Promise<boolean> {
  return (await colourAt(page, x, y)) !== "";
}

/** The words in the text box, line breaks as "\n"; the caret's place-holder left out. */
async function typed(box: Locator): Promise<string> {
  return box.evaluate((el: HTMLElement) => el.innerText.replace(/\u200b/g, "").replace(/\n$/, ""));
}

/** The words in the text box that are bold, in order. */
async function boldIn(box: Locator): Promise<string> {
  return box.evaluate((el: HTMLElement) =>
    Array.from(el.querySelectorAll("span"))
      .filter((span) => Number(getComputedStyle(span).fontWeight) >= 600)
      .map((span) => span.textContent ?? "")
      .join("")
      .replace(/\u200b/g, ""),
  );
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
    expect(await cancelSheet(page, sheetId)).toBe(200);
  });

  test("words are typed, formatted and typed over again, and stay editable once saved", async ({ page }) => {
    test.slow();
    const sheetId = await openNewSheet(page);
    await sheet(page).getByRole("button", { name: "Vẽ lược đồ" }).click();
    const dialog = page.getByRole("dialog", { name: "Vẽ lược đồ phẫu thuật/thủ thuật" });
    const area = page.getByRole("img", { name: "Vùng vẽ lược đồ" });
    const box = dialog.getByRole("textbox", { name: "Nhập chữ lên lược đồ" });

    await dialog.getByRole("button", { name: "Chữ", exact: true }).click();
    await area.click({ position: { x: 60, y: 60 } });
    await expect(box).toBeFocused();

    // Esc drops the words, and only the words: the dialog stays open.
    await box.pressSequentially("bỏ");
    await box.press("Escape");
    await expect(box).toBeHidden();
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Hoàn tác" })).toBeDisabled();

    // As in Paint: Enter is a new line; the text bar, docked above the page, formats without taking the caret.
    const bar = dialog.getByRole("toolbar", { name: "Định dạng chữ" });
    await expect(bar).toBeVisible();
    await area.click({ position: { x: 60, y: 60 } });
    await box.pressSequentially("Răng 36");
    await box.press("Enter");
    await box.pressSequentially("Cắt chóp");
    await expect.poll(() => typed(box)).toBe("Răng 36\nCắt chóp");

    // Only the highlighted words take the style.
    await box.press("Shift+Home");
    await bar.getByRole("button", { name: "In đậm" }).click();
    await expect(bar.getByRole("button", { name: "In đậm" })).toHaveAttribute("aria-pressed", "true");
    await expect(box).toBeFocused();
    await expect.poll(() => boldIn(box)).toBe("Cắt chóp");
    await box.press("End");

    // Sized narrower by its handle, the words wrap and the box grows to fit them.
    const frame = dialog.locator(".sketch-text-frame");
    const before = (await frame.boundingBox())!;
    const grip = (await dialog.locator('[data-grip="e"]').boundingBox())!;
    await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2);
    await page.mouse.down();
    await page.mouse.move(before.x + before.width * 0.3, grip.y + grip.height / 2, { steps: 6 });
    await page.mouse.up();
    const after = (await frame.boundingBox())!;
    expect(after.width).toBeLessThan(before.width * 0.5);
    expect(after.height).toBeGreaterThan(before.height * 1.4);
    await expect(box).toBeFocused();
    await expect.poll(() => typed(box)).toBe("Răng 36\nCắt chóp");

    // A click elsewhere on the page puts the words down.
    const bounds = (await area.boundingBox())!;
    await area.click({ position: { x: bounds.width * 0.6, y: bounds.height * 0.6 } });
    await expect(box).toBeHidden();
    await expect(dialog.getByRole("button", { name: "Hoàn tác" })).toBeEnabled();
    expect(await inkOn(page)).toBeGreaterThan(200);

    // Picked out again with the select tool, they open for typing.
    await dialog.getByRole("button", { name: "Chọn", exact: true }).click();
    await area.dblclick({ position: { x: 70, y: 70 } });
    await expect.poll(() => typed(box)).toBe("Răng 36\nCắt chóp");
    await box.press("Control+End");
    await box.pressSequentially(" 2 chân");
    await box.press("Control+Enter");
    await expect(box).toBeHidden();

    await page.keyboard.press("Control+z");
    await expect(dialog.getByRole("button", { name: "Làm lại" })).toBeEnabled();
    await page.keyboard.press("Control+y");

    await dialog.getByRole("button", { name: "Áp dụng" }).click();
    expect(await drawingSource(page)).toMatch(/^data:image\/png;base64,/);
    await save(page);
    await reopen(page);
    expect(await drawingSource(page)).toMatch(SAVED_LINK);
    expect(await pictureLoaded(page)).toBe(true);

    // Saved and reopened, the words are still words, not pixels.
    await sheet(page).getByRole("button", { name: "Sửa bản vẽ" }).click();
    await expect(dialog.locator(".ant-spin-spinning")).toHaveCount(0);
    await dialog.getByRole("button", { name: "Chọn", exact: true }).click();
    await area.dblclick({ position: { x: 70, y: 70 } });
    await expect.poll(() => typed(box)).toBe("Răng 36\nCắt chóp 2 chân");
    // Each stretch keeps its own style: typed on after the bold words, the new ones are bold too.
    expect(await boldIn(box)).toBe("Cắt chóp 2 chân");
    await box.press("Escape");
    await dialog.getByRole("button", { name: "Huỷ" }).click();

    expect(await cancelSheet(page, sheetId)).toBe(200);
  });

  test("a stroke is picked out with the select tool: moved, recoloured, deleted; the eraser rubs out only where it passes", async ({ page }) => {
    test.slow();
    const sheetId = await openNewSheet(page);
    await sheet(page).getByRole("button", { name: "Vẽ lược đồ" }).click();
    const dialog = page.getByRole("dialog", { name: "Vẽ lược đồ phẫu thuật/thủ thuật" });
    const area = page.getByRole("img", { name: "Vùng vẽ lược đồ" });
    const selection = dialog.getByRole("toolbar", { name: "Đối tượng đang chọn" });

    await drag(page, [0.2, 0.5], [0.6, 0.5]);
    expect(await inkAt(page, 0.4, 0.5)).toBe(true);

    await dialog.getByRole("button", { name: "Chọn", exact: true }).click();
    const box = (await area.boundingBox())!;
    await page.mouse.click(box.x + box.width * 0.4, box.y + box.height * 0.5);
    await expect(selection).toBeVisible();

    // Esc lets go of it, and only of it.
    await page.keyboard.press("Escape");
    await expect(selection).toBeHidden();
    await expect(dialog).toBeVisible();
    await page.mouse.click(box.x + box.width * 0.4, box.y + box.height * 0.5);
    await expect(selection).toBeVisible();

    // Recoloured from the shared colour box.
    await dialog.getByRole("button", { name: "#22b14c" }).click();
    expect(await colourAt(page, 0.4, 0.5)).toBe("34,177,76");

    // Moved by dragging it.
    await drag(page, [0.4, 0.5], [0.4, 0.8]);
    expect(await inkAt(page, 0.4, 0.8)).toBe(true);
    expect(await inkAt(page, 0.4, 0.5)).toBe(false);

    // Deleted with the key, back with undo.
    await page.keyboard.press("Delete");
    expect(await inkOn(page)).toBe(0);
    await page.keyboard.press("Control+z");
    expect(await inkAt(page, 0.4, 0.8)).toBe(true);

    // As in Paint, the eraser takes away only what it passes over.
    const tool = (name: string) => dialog.getByRole("button", { name, exact: true }).click();
    const clickAt = (x: number, y: number) => page.mouse.click(box.x + box.width * x, box.y + box.height * y);
    await tool("Tẩy");
    await drag(page, [0.3, 0.7], [0.3, 0.9]);
    expect(await inkAt(page, 0.3, 0.8)).toBe(false);
    expect(await inkAt(page, 0.22, 0.8)).toBe(true);
    expect(await inkAt(page, 0.5, 0.8)).toBe(true);

    // The gap is part of the stroke: nothing is picked there, and it moves along with the rest.
    await tool("Chọn");
    await clickAt(0.3, 0.8);
    await expect(selection).toBeHidden();
    await clickAt(0.5, 0.8);
    await expect(selection).toBeVisible();
    await drag(page, [0.5, 0.8], [0.5, 0.6]);
    expect(await inkAt(page, 0.3, 0.6)).toBe(false);
    expect(await inkAt(page, 0.45, 0.6)).toBe(true);
    expect(await inkAt(page, 0.45, 0.8)).toBe(false);

    // Rubbed out end to end, the stroke is gone: nothing is left to pick.
    await tool("Tẩy");
    await drag(page, [0.15, 0.6], [0.65, 0.6]);
    expect(await inkOn(page)).toBe(0);
    await tool("Chọn");
    await clickAt(0.45, 0.6);
    await expect(selection).toBeHidden();

    // Undo brings it back as the eraser had left it.
    await page.keyboard.press("Control+z");
    expect(await inkAt(page, 0.45, 0.6)).toBe(true);
    expect(await inkAt(page, 0.3, 0.6)).toBe(false);

    // Saved and reopened, the gap is still there and the rest still a stroke.
    await dialog.getByRole("button", { name: "Áp dụng" }).click();
    await save(page);
    await reopen(page);
    expect(await drawingSource(page)).toMatch(SAVED_LINK);
    expect(await pictureLoaded(page)).toBe(true);
    await sheet(page).getByRole("button", { name: "Sửa bản vẽ" }).click();
    await expect(dialog.locator(".ant-spin-spinning")).toHaveCount(0);
    expect(await inkAt(page, 0.45, 0.6)).toBe(true);
    expect(await inkAt(page, 0.3, 0.6)).toBe(false);
    await tool("Chọn");
    await clickAt(0.45, 0.6);
    await expect(selection).toBeVisible();

    await dialog.getByRole("button", { name: "Huỷ" }).click();
    expect(await cancelSheet(page, sheetId)).toBe(200);
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
      await fetch(`/api/v1/app/patient-medical-records/${id}/cancel`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(xsrf ? { RequestVerificationToken: decodeURIComponent(xsrf) } : {}),
        },
        body: JSON.stringify({ reason: "E2E dọn dẹp" }),
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
