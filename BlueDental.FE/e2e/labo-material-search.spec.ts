import { expect, test, type Locator, type Page } from "@playwright/test";
import { assertRealApiTraffic, login } from "./fixtures/auth";

/**
 * Feature: dialog Đặt mới / Bảo hành of the patient's Labo tab — the search box
 * beside "Vật liệu" (R-1062, a BlueDental addition the reference does not have).
 *
 * Real stack: login through the screen, the strips read the real catalog, Lưu
 * posts to the real API and a reload reads the row back. The only shortcut is
 * seeding one dedicated group with three materials, through the endpoints the
 * Labo catalog screens call, with the browser's own cookie.
 */

interface Target {
  patientId: string;
  branchId: string;
}

interface Seeded {
  supplierName: string;
}

/** A group of its own, so its chips are exactly these three on every run. */
const GROUP = "Dịch vụ tìm vật liệu e2e";
const ZIRCONIA = "Sứ Zirconia Aizir (e2e tìm)";
const EMAX = "Sứ Emax (e2e tìm)";
const DENTURE = "Răng tháo lắp Đức (e2e tìm)";

/** A patient owning a slip with an open service line, in that slip's branch. */
async function findStageablePatient(page: Page): Promise<Target> {
  await page.goto("/patient");
  await assertRealApiTraffic(page, "/api/v1/app/patients");
  const found = await page.evaluate(async () => {
    const res = await fetch("/api/v1/app/patient-treatments?maxResultCount=50", {
      credentials: "include",
    });
    const items = (await res.json()).items as {
      patientId: string;
      branchId: string;
      services: { status: number }[];
    }[];
    const slip = items.find((row) =>
      row.services.some((line) => line.status === 1 || line.status === 2),
    );
    return slip ? { patientId: slip.patientId, branchId: slip.branchId } : null;
  });
  expect(found, "the demo clinic should have a slip with an open service line").toBeTruthy();
  return found!;
}

/** A supplier (any) and the dedicated group with its three materials, each made only if missing. */
async function seedCatalog(page: Page, branchId: string): Promise<Seeded> {
  return page.evaluate(
    async ({ branchId, group, materials }) => {
      const xsrf = document.cookie
        .split("; ")
        .find((c) => c.startsWith("XSRF-TOKEN="))
        ?.substring("XSRF-TOKEN=".length);
      const headers = {
        "content-type": "application/json",
        "X-Clinic-Branch-Id": branchId,
        ...(xsrf ? { RequestVerificationToken: decodeURIComponent(xsrf) } : {}),
      };
      const get = async (url: string) =>
        (await (await fetch(url, { credentials: "include", headers })).json()) as {
          items: { id: string; name: string }[];
        };
      const post = async (url: string, body: unknown) => {
        const res = await fetch(url, {
          method: "POST",
          credentials: "include",
          headers,
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error(`${url} → ${res.status} ${await res.text()}`);
        return (await res.json()) as { id: string; name: string };
      };

      const suppliers = await get(
        `/api/v1/app/labo-suppliers?ClinicBranchId=${branchId}&IsActive=true&MaxResultCount=1`,
      );
      const supplier =
        suppliers.items[0] ??
        (await post("/api/v1/app/labo-suppliers", {
          name: "Labo e2e tìm vật liệu",
          email: "labo-material-search@example.com",
          clinicBranchId: branchId,
        }));

      const groups = await get(
        `/api/v1/app/taxonomies?ClinicBranchId=${branchId}&Group=labo_material&MaxResultCount=200`,
      );
      const taxonomy =
        groups.items.find((row) => row.name === group) ??
        (await post("/api/v1/app/taxonomies", {
          group: "labo_material",
          name: group,
          clinicBranchId: branchId,
        }));
      const existing = await get(
        `/api/v1/app/labo-materials?ClinicBranchId=${branchId}&TaxonomyId=${taxonomy.id}&MaxResultCount=200`,
      );
      for (const name of materials) {
        if (existing.items.some((row) => row.name === name)) continue;
        await post("/api/v1/app/labo-materials", {
          name,
          taxonomyId: taxonomy.id,
          clinicBranchId: branchId,
        });
      }
      return { supplierName: supplier.name };
    },
    { branchId, group: GROUP, materials: [ZIRCONIA, EMAX, DENTURE] },
  );
}

/** Opens a SearchSelect (the app's own combobox) and takes the option matching `name`. */
async function pickOption(page: Page, combobox: Locator, name?: RegExp | string) {
  await combobox.locator(".ss-trigger").click();
  const options = page.locator("#ss-portal-dropdown .ss-option");
  const option = name ? options.filter({ hasText: name }).first() : options.first();
  await expect(option).toBeVisible();
  await option.click();
}

/** The floating field carrying that label. */
function field(scope: Locator, label: string) {
  return scope.locator(".floating-field").filter({ hasText: label }).first();
}

/**
 * Ngày nhận dự kiến, a week out. The picker is in mask mode: fill() is ignored
 * and typing edits the cell under the caret, so start at the left edge and type
 * the digits bare; each full cell hands over to the next.
 */
async function fillDueDate(scope: Locator, page: Page) {
  const input = field(scope, "Ngày nhận dự kiến").locator("input");
  const due = new Date(Date.now() + 7 * 24 * 3600 * 1000);
  const day = String(due.getDate()).padStart(2, "0");
  const month = String(due.getMonth() + 1).padStart(2, "0");
  const text = `${day}/${month}/${due.getFullYear()}`;
  await input.click({ position: { x: 4, y: 8 } });
  await input.pressSequentially(text.replace(/\D/g, ""));
  await page.keyboard.press("Enter");
  await expect(input).toHaveValue(text);
}

/** Giờ nhận: typed whole, taken on Tab (the panel has no OK; Enter would submit). */
async function fillDueTime(scope: Locator) {
  const input = field(scope, "Giờ nhận").locator("input");
  await input.click();
  await input.fill("09:30");
  await input.press("Tab");
  await expect(input).toHaveValue("09:30");
}

/** Bác sĩ chỉ định follows the line when it has one; otherwise the first doctor. */
async function ensureDoctor(scope: Locator, page: Page) {
  const doctor = field(scope, "Bác sĩ chỉ định");
  if (!(await doctor.evaluate((node) => node.classList.contains("floating-field--floated")))) {
    await pickOption(page, doctor);
  }
}

/** The rows whose Mã phiếu cell is exactly this code. */
function rowsWithCode(page: Page, code: string) {
  return page
    .locator(".pd-pane--fill tbody tr.ant-table-row")
    .filter({ has: page.locator("td", { hasText: new RegExp(`^${code}$`) }) });
}

/** The chips shown, in any order: the server sorts the catalog its own way. */
async function expectChips(chips: Locator, names: string[]) {
  await expect
    .poll(async () => (await chips.allTextContents()).map((text) => text.trim()).sort())
    .toEqual([...names].sort());
}

/** Lựa chọn dịch vụ and Vật liệu, the box beside the latter and its chips. */
function materialStrips(dialog: Locator) {
  const strips = dialog.locator(".pd-labo-strip");
  const material = strips.nth(1);
  return {
    services: strips.nth(0).locator(".pd-labo-chips button"),
    material,
    search: material.getByRole("textbox", { name: "Tìm kiếm vật liệu" }),
    chips: material.locator(".pd-labo-chips button"),
  };
}

test.describe("Labo dialog — Vật liệu search (R-1062)", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 900 });
    await login(page);
  });

  test("narrows the chips accent-blind, keeps the pick, saves; Bảo hành has it too", async ({
    page,
  }) => {
    const target = await findStageablePatient(page);
    const seeded = await seedCatalog(page, target.branchId);

    await page.goto(`/patient/${target.patientId}?branchId=${target.branchId}&tab=labo`);
    await assertRealApiTraffic(page, "/api/v1/app/labo-orders");
    await page.getByRole("button", { name: "Tạo phiếu Labo" }).click();
    const dialog = page.getByRole("dialog", { name: "Đặt mới" });
    await expect(dialog).toBeVisible();
    const strips = materialStrips(dialog);

    // ── Only Vật liệu has the box; it waits for a service group ──────────
    await expect(dialog.locator(".pd-labo-strip-search")).toHaveCount(1);
    await expect(strips.material.locator(".pd-labo-strip-head > p")).toHaveText(/Vật liệu/);
    await expect(strips.search).toBeDisabled();
    await expect(strips.material).toContainText("Chọn dịch vụ trước");

    await strips.services.filter({ hasText: GROUP }).click();
    await expect(strips.search).toBeEnabled();
    await expect(strips.chips).toHaveCount(3);

    // ── Accent- and case-blind, on any part of the name (R-1051) ─────────
    await strips.search.fill("zirconia");
    await expectChips(strips.chips, [ZIRCONIA]);
    await strips.search.fill("su");
    await expectChips(strips.chips, [ZIRCONIA, EMAX]);
    await strips.search.fill("DUC");
    await expectChips(strips.chips, [DENTURE]);
    await strips.search.fill("không có vật liệu này");
    await expect(strips.chips).toHaveCount(0);
    await expect(strips.material.locator(".pd-labo-emptypill")).toHaveText(
      "Không tìm thấy vật liệu",
    );

    // ── The pick outlives its chip being filtered out ─────────────────────
    await strips.search.fill("emax");
    await strips.chips.filter({ hasText: EMAX }).click();
    await expect(strips.chips.filter({ hasText: EMAX })).toHaveAttribute("aria-pressed", "true");
    await strips.search.fill("duc");
    await expectChips(strips.chips, [DENTURE]);
    await strips.search.fill("");
    await expect(strips.chips).toHaveCount(3);
    await expect(strips.chips.filter({ hasText: EMAX })).toHaveAttribute("aria-pressed", "true");

    // ── Enter in the box does not submit the half-filled form ─────────────
    await strips.search.fill("emax");
    await strips.search.press("Enter");
    // Validation runs async, so an absence is only worth checking after a beat.
    await page.waitForTimeout(800);
    await expect(dialog.locator(".ant-form-item-explain-error")).toHaveCount(0);
    await expect(dialog).toBeVisible();

    // ── Lưu without a material: the label and hint go red, the box does not ─
    await strips.chips.filter({ hasText: EMAX }).click();
    await expect(strips.chips.filter({ hasText: EMAX })).toHaveAttribute("aria-pressed", "false");
    await dialog.locator(".pd-labo-footer").getByRole("button", { name: "Lưu" }).click();
    await expect(strips.material).toHaveClass(/pd-labo-strip--error/);
    await expect(
      dialog.locator(".ant-form-item-explain-error", { hasText: "Vui lòng chọn vật liệu." }),
    ).toBeVisible();
    await expect(strips.material.locator(".pd-labo-strip-search")).not.toHaveClass(/status-error/);
    await expect(dialog).toBeVisible();

    // ── Another group clears the box with the material ───────────────────
    const otherGroup = strips.services.filter({ hasNotText: GROUP }).first();
    if ((await otherGroup.count()) > 0) {
      await otherGroup.click();
      await expect(strips.search).toHaveValue("");
      await expect(strips.material.locator('.pd-labo-chips [aria-pressed="true"]')).toHaveCount(0);
      await strips.services.filter({ hasText: GROUP }).click();
      await expect(strips.chips).toHaveCount(3);
      await expect(strips.chips.filter({ hasText: EMAX })).toHaveAttribute(
        "aria-pressed",
        "false",
      );
    }

    // ── Picked through the box, saved, read back after a reload ──────────
    await strips.search.fill("zircon");
    await strips.chips.filter({ hasText: ZIRCONIA }).click();
    await pickOption(page, field(dialog, "Dịch vụ điều trị"));
    await ensureDoctor(dialog, page);
    await pickOption(page, field(dialog, "Nhà cung cấp"), seeded.supplierName);
    await fillDueDate(dialog, page);
    await fillDueTime(dialog);
    const code = await field(dialog, "Số phiếu Labo").locator("input").inputValue();
    expect(code).toMatch(/^LABO-\d+$/);
    await expect(dialog.locator(".ant-form-item-explain-error")).toHaveCount(0);
    await dialog.locator(".pd-labo-footer").getByRole("button", { name: "Lưu" }).click();
    await expect(page.getByText("Đã tạo phiếu Labo")).toBeVisible();
    await expect(dialog).toBeHidden();

    await page.reload();
    await assertRealApiTraffic(page, "/api/v1/app/labo-orders");
    const row = rowsWithCode(page, code).first();
    await expect(row).toContainText(ZIRCONIA);

    // ── Bảo hành → Thay đổi vật liệu mới: the same box ───────────────────
    await row.getByRole("button", { name: "Bảo hành" }).click();
    const warranty = page.getByRole("dialog", { name: "Bảo hành" });
    await expect(warranty).toBeVisible();
    await warranty.getByRole("radio", { name: "Thay đổi vật liệu mới" }).check();
    const child = materialStrips(warranty);
    await expect(child.search).toBeDisabled();
    await child.services.filter({ hasText: GROUP }).click();
    await child.search.fill("tháo lắp");
    await expectChips(child.chips, [DENTURE]);
    await child.chips.click();
    await fillDueDate(warranty, page);
    await fillDueTime(warranty);
    await warranty.locator(".pd-labo-footer").getByRole("button", { name: "Lưu" }).click();
    await expect(page.getByText("Đã tạo phiếu Labo")).toBeVisible();
    await expect(warranty).toBeHidden();

    await page.reload();
    await assertRealApiTraffic(page, "/api/v1/app/labo-orders");
    const warrantyRow = rowsWithCode(page, code).filter({ hasText: "Bảo hành" }).first();
    await expect(warrantyRow).toContainText(DENTURE);
  });
});
