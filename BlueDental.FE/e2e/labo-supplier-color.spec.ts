import { expect, test, type Locator, type Page } from "@playwright/test";
import { assertRealApiTraffic, login, runId } from "./fixtures/auth";
import { findLaboPatient } from "./fixtures/laboSeed";

/**
 * Feature: Màu nhãn on Nhà cung cấp Labo (R-1072, a BlueDental addition the
 * reference does not have). The dialog picks Mặc định (grey), one of eight
 * presets or any colour; the supplier's name then reads as a solid badge in
 * that colour on its own table. Mẫu Labo and the patient's Labo tab showed it
 * too until F-91 (R-1198) took the supplier out of the Labo lists.
 *
 * Real stack: login through the screen, the supplier is created and edited
 * through the dialog, every reading comes from the real API and a reload reads
 * it back.
 */

const BLUE = { hex: "#2671D8", rgb: "rgb(38, 113, 216)" };
const GREY_RGB = "rgb(100, 116, 139)";
const PALE = { hex: "#fef08a", rgb: "rgb(254, 240, 138)" };
const WHITE_RGB = "rgb(255, 255, 255)";
const INK_RGB = "rgb(23, 28, 51)";

const background = (badge: Locator) => badge.evaluate((el) => getComputedStyle(el).backgroundColor);
const textColor = (badge: Locator) => badge.evaluate((el) => getComputedStyle(el).color);

/** The badge on the Nhà cung cấp Labo row carrying that name. */
function supplierBadge(page: Page, name: string) {
  return page.getByRole("row").filter({ hasText: name }).locator(".bd-label-badge").first();
}

/** Opens the supplier's edit dialog, runs `pick` in it and saves. */
async function editColour(page: Page, name: string, pick: (dialog: Locator) => Promise<void>) {
  await page.getByRole("button", { name: `Chỉnh sửa ${name}` }).click();
  const dialog = page.getByRole("dialog");
  await pick(dialog);
  const saved = page.waitForResponse(
    (res) => res.url().includes("/labo-suppliers/") && res.request().method() === "PUT",
  );
  await dialog.getByRole("button", { name: /Lưu/ }).click();
  expect((await saved).status()).toBe(200);
  await expect(dialog).toBeHidden({ timeout: 10_000 });
}

test.describe("Nhà cung cấp Labo — Màu nhãn (R-1072)", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 900 });
    await login(page);
  });

  test("the chosen colour paints the supplier badge on its table, and Mặc định brings back grey", async ({
    page,
  }) => {
    const id = runId();
    const name = `Labo màu e2e ${id}`;

    // ── Create with a preset: the preview follows the name and the colour ──
    await page.goto("/labo/supplier");
    await assertRealApiTraffic(page, "/labo-suppliers");
    await page.getByRole("button", { name: /Tạo nhà cung cấp/ }).click();
    const dialog = page.getByRole("dialog");

    const swatches = dialog.getByRole("radiogroup", { name: "Màu nhãn" }).getByRole("radio");
    await expect(swatches).toHaveCount(9);
    await expect(dialog.getByRole("radio", { name: "Mặc định (xám)" })).toHaveAttribute("aria-checked", "true");

    await dialog.getByRole("textbox", { name: /Tên nhà cung cấp/ }).fill(name);
    await dialog.getByRole("textbox", { name: /^Email/ }).fill(`labo-mau-${id}@example.com`);
    const preview = dialog.locator(".bd-label-preview .bd-label-badge");
    await expect(preview).toHaveText(name);
    expect(await background(preview)).toBe(GREY_RGB);

    await dialog.getByRole("radio", { name: `Chọn màu ${BLUE.hex}` }).click();
    await expect(dialog.getByRole("radio", { name: `Chọn màu ${BLUE.hex}` })).toHaveAttribute("aria-checked", "true");
    expect(await background(preview)).toBe(BLUE.rgb);

    const created = page.waitForResponse(
      (res) => res.url().endsWith("/labo-suppliers") && res.request().method() === "POST",
    );
    await dialog.getByRole("button", { name: /Lưu/ }).click();
    const createdRes = await created;
    expect(createdRes.status()).toBe(200);
    expect(((await createdRes.json()) as { labelColor: string }).labelColor).toBe(BLUE.hex);
    await expect(dialog).toBeHidden({ timeout: 10_000 });

    // ── The table reads it back from the server, white on blue ────────────
    await page.reload();
    await assertRealApiTraffic(page, "/labo-suppliers");
    const badge = supplierBadge(page, name);
    await expect(badge).toHaveText(name);
    expect(await background(badge)).toBe(BLUE.rgb);
    expect(await textColor(badge)).toBe(WHITE_RGB);

    // ── Mặc định clears it: grey again after a reload ─────────────────────
    await editColour(page, name, async (edit) => {
      await expect(edit.getByRole("radio", { name: `Chọn màu ${BLUE.hex}` })).toHaveAttribute("aria-checked", "true");
      await edit.getByRole("radio", { name: "Mặc định (xám)" }).click();
    });
    await page.reload();
    await assertRealApiTraffic(page, "/labo-suppliers");
    expect(await background(supplierBadge(page, name))).toBe(GREY_RGB);
  });

  test("a custom pale colour is kept and turns the text dark", async ({ page }) => {
    const id = runId();
    const name = `Labo màu nhạt e2e ${id}`;
    await page.goto("/labo/supplier");
    await assertRealApiTraffic(page, "/labo-suppliers");

    await page.getByRole("button", { name: /Tạo nhà cung cấp/ }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("textbox", { name: /Tên nhà cung cấp/ }).fill(name);
    await dialog.getByRole("textbox", { name: /^Email/ }).fill(`labo-nhat-${id}@example.com`);
    await dialog.getByLabel("Màu tùy chọn").fill(PALE.hex);

    // No preset is picked; the custom well wears the colour instead.
    await expect(dialog.getByRole("radio", { checked: true })).toHaveCount(0);
    await expect(dialog.locator(".bd-label-swatch--custom")).toHaveClass(/bd-label-swatch--picked/);
    const preview = dialog.locator(".bd-label-preview .bd-label-badge");
    expect(await background(preview)).toBe(PALE.rgb);
    expect(await textColor(preview)).toBe(INK_RGB);

    await dialog.getByRole("button", { name: /Lưu/ }).click();
    await expect(dialog).toBeHidden({ timeout: 10_000 });

    await page.reload();
    await assertRealApiTraffic(page, "/labo-suppliers");
    const badge = supplierBadge(page, name);
    expect(await background(badge)).toBe(PALE.rgb);
    expect(await textColor(badge)).toBe(INK_RGB);

    // Reopened, the dialog shows the stored colour in the custom well.
    await page.getByRole("button", { name: `Chỉnh sửa ${name}` }).click();
    await expect(page.getByRole("dialog").getByLabel("Màu tùy chọn")).toHaveValue(PALE.hex);
  });

  test("the server refuses a colour that is not #RRGGBB", async ({ page }) => {
    const id = runId();
    const target = await findLaboPatient(page);
    const result = await page.evaluate(
      async ({ branchId, id }) => {
        const xsrf = document.cookie
          .split("; ")
          .find((c) => c.startsWith("XSRF-TOKEN="))
          ?.substring("XSRF-TOKEN=".length);
        const headers = {
          "content-type": "application/json",
          accept: "application/json",
          "X-Clinic-Branch-Id": branchId,
          ...(xsrf ? { RequestVerificationToken: decodeURIComponent(xsrf) } : {}),
        };
        const name = `Labo màu sai e2e ${id}`;
        const res = await fetch("/api/v1/app/labo-suppliers", {
          method: "POST",
          credentials: "include",
          headers,
          body: JSON.stringify({
            name,
            email: `labo-sai-${id}@example.com`,
            clinicBranchId: branchId,
            labelColor: "red",
          }),
        });
        const after = (await (
          await fetch(
            `/api/v1/app/labo-suppliers?ClinicBranchId=${branchId}&Filter=${encodeURIComponent(name)}`,
            { credentials: "include", headers },
          )
        ).json()) as { totalCount: number };
        return { status: res.status, stored: after.totalCount };
      },
      { branchId: target.branchId, id },
    );

    expect(result.status).toBe(400);
    expect(result.stored).toBe(0);
  });
});
