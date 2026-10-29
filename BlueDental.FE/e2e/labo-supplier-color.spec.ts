import { expect, test, type Locator, type Page } from "@playwright/test";
import { assertRealApiTraffic, login, runId } from "./fixtures/auth";
import { findLaboPatient, type LaboTarget } from "./fixtures/laboSeed";

/**
 * Feature: Màu nhãn on Nhà cung cấp Labo (R-1072, a BlueDental addition the
 * reference does not have). The dialog picks Mặc định (grey), one of eight
 * presets or any colour; the supplier's name then reads as a solid badge in
 * that colour on its own table, on Mẫu Labo and on the patient's Labo tab.
 *
 * Real stack: login through the screen, the supplier is created and edited
 * through the dialog, every reading comes from the real API and a reload reads
 * it back. The only shortcut is the one order that carries the supplier, posted
 * the way the order dialog posts it with the browser's own cookie.
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

/** The badge in the Labo row whose Mã phiếu cell is exactly this code. */
function orderBadge(page: Page, scope: string, code: string) {
  return page
    .locator(`${scope} tbody tr.ant-table-row`)
    .filter({ has: page.locator("td", { hasText: new RegExp(`^${code}$`) }) })
    .first()
    .locator(".bd-label-badge");
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

/** The supplier's id, then one Đặt mới order on the patient carrying it. */
async function seedOrderWithSupplier(page: Page, target: LaboTarget, supplierName: string, id: string) {
  return page.evaluate(
    async ({ target, supplierName, id }) => {
      const xsrf = document.cookie
        .split("; ")
        .find((c) => c.startsWith("XSRF-TOKEN="))
        ?.substring("XSRF-TOKEN=".length);
      const headers = {
        "content-type": "application/json",
        "X-Clinic-Branch-Id": target.branchId,
        ...(xsrf ? { RequestVerificationToken: decodeURIComponent(xsrf) } : {}),
      };
      const list = (await (
        await fetch(
          `/api/v1/app/labo-suppliers?ClinicBranchId=${target.branchId}&Filter=${encodeURIComponent(supplierName)}&MaxResultCount=5`,
          { credentials: "include", headers },
        )
      ).json()) as { items: { id: string; name: string }[] };
      const supplier = list.items.find((row) => row.name === supplierName);
      if (!supplier) throw new Error(`supplier ${supplierName} not found in branch ${target.branchId}`);

      const res = await fetch("/api/v1/app/labo-orders", {
        method: "POST",
        credentials: "include",
        headers,
        body: JSON.stringify({
          patientId: target.patientId,
          branchId: target.branchId,
          supplierId: supplier.id,
          labProviderName: supplierName,
          kind: 1,
          estimatedCost: 0,
          quantity: 1,
          toothNumbers: "21",
          workDescription: `Màu nhãn e2e ${id}`,
          sentAt: new Date().toISOString(),
        }),
      });
      if (!res.ok) throw new Error(`POST labo-orders → ${res.status} ${await res.text()}`);
      return ((await res.json()) as { orderCode: string }).orderCode;
    },
    { target, supplierName, id },
  );
}

test.describe("Nhà cung cấp Labo — Màu nhãn (R-1072)", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 900 });
    await login(page);
  });

  test("the chosen colour paints the supplier badge everywhere, and Mặc định brings back grey", async ({
    page,
  }) => {
    const id = runId();
    const name = `Labo màu e2e ${id}`;
    const target = await findLaboPatient(page);

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

    // ── An order carrying the supplier shows the same badge on both Labo tables ─
    const orderCode = await seedOrderWithSupplier(page, target, name, id);

    await page.goto("/labo/mau-labo");
    await assertRealApiTraffic(page, "/api/v1/app/labo-orders");
    const sampleBadge = orderBadge(page, ".bd-labo-screen", orderCode);
    await expect(sampleBadge).toHaveText(name);
    expect(await background(sampleBadge)).toBe(BLUE.rgb);

    await page.goto(`/patient/${target.patientId}?branchId=${target.branchId}&tab=labo`);
    await assertRealApiTraffic(page, "/api/v1/app/labo-orders");
    const tabBadge = orderBadge(page, ".pd-pane--fill", orderCode);
    await expect(tabBadge).toHaveText(name);
    expect(await background(tabBadge)).toBe(BLUE.rgb);

    // ── Mặc định clears it: grey on the table and on Mẫu Labo ─────────────
    await page.goto("/labo/supplier");
    await assertRealApiTraffic(page, "/labo-suppliers");
    await editColour(page, name, async (edit) => {
      await expect(edit.getByRole("radio", { name: `Chọn màu ${BLUE.hex}` })).toHaveAttribute("aria-checked", "true");
      await edit.getByRole("radio", { name: "Mặc định (xám)" }).click();
    });
    await page.reload();
    await assertRealApiTraffic(page, "/labo-suppliers");
    expect(await background(supplierBadge(page, name))).toBe(GREY_RGB);

    await page.goto("/labo/mau-labo");
    await assertRealApiTraffic(page, "/api/v1/app/labo-orders");
    await expect(orderBadge(page, ".bd-labo-screen", orderCode)).toHaveText(name);
    expect(await background(orderBadge(page, ".bd-labo-screen", orderCode))).toBe(GREY_RGB);
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
