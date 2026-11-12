import { expect, test, type Locator, type Page } from "@playwright/test";
import { assertRealApiTraffic, login } from "./fixtures/auth";

/**
 * Feature: the Đặt hàng step of the patient's Labo dialog — finding a material
 * by name (R-1062, a BlueDental addition). Since P3110 (REQ-C4/C5) the box
 * lives in the «Xem thêm vật liệu» popup instead of beside the strip.
 * The Bảo hành child order it also covered went with P2910_03 (F-85): a
 * warranty is now a card per tooth, with no new order and no material.
 *
 * Real stack: login through the screen, the rows read the real catalog, Lưu
 * posts to the real API and a reload reads the row back. The only shortcut is
 * seeding one dedicated group with four materials, through the endpoints the
 * Labo catalog screens call, with the browser's own cookie.
 */

interface Target {
  patientId: string;
  branchId: string;
}

interface Seeded {
  supplierName: string;
}

/** A group of its own, so its popup lists exactly these four on every run: one more than the row shows. */
const GROUP = "Dịch vụ tìm vật liệu e2e";
const ZIRCONIA = "Sứ Zirconia Aizir (e2e tìm)";
const EMAX = "Sứ Emax (e2e tìm)";
const DENTURE = "Răng tháo lắp Đức (e2e tìm)";
const TITAN = "Sứ kim loại Titan (e2e tìm)";

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
          code: name.slice(0, 50),
          name,
          taxonomyId: taxonomy.id,
          clinicBranchId: branchId,
        });
      }
      return { supplierName: supplier.name };
    },
    { branchId, group: GROUP, materials: [ZIRCONIA, EMAX, DENTURE, TITAN] },
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

/** The names shown, in any order: the server sorts the catalog its own way. */
async function expectNames(items: Locator, names: string[]) {
  await expect
    .poll(async () => (await items.allTextContents()).map((text) => text.trim()).sort())
    .toEqual([...names].sort());
}

/** Dịch vụ and Vật liệu (P3110 m134): their chips and their «Xem thêm» pills. */
function choiceRows(dialog: Locator) {
  const rows = dialog.locator(".pd-labo-choice");
  const material = rows.nth(1);
  return {
    service: rows.nth(0),
    services: rows.nth(0).locator(".pd-labo-choice-chip"),
    material,
    chips: material.locator(".pd-labo-choice-chip"),
    more: material.getByRole("button", { name: "Xem thêm vật liệu" }),
  };
}

/** The «Xem thêm» popup open on top of the dialog. */
function choicePopup(page: Page, title: string) {
  const popup = page.locator(".pd-labo-pick").filter({ hasText: title });
  return {
    popup,
    search: popup.getByRole("textbox"),
    names: popup.locator(".pd-labo-pick-row b"),
    row: (name: string) => popup.getByRole("radio").filter({ hasText: name }),
  };
}

/** The dedicated group: its chip when the row shows it, else found through «Xem thêm dịch vụ». */
async function pickGroup(page: Page, dialog: Locator) {
  const rows = choiceRows(dialog);
  const chip = rows.services.filter({ hasText: GROUP });
  if ((await chip.count()) > 0) {
    await chip.click();
    return;
  }
  await rows.service.getByRole("button", { name: "Xem thêm dịch vụ" }).click();
  const services = choicePopup(page, "Chọn dịch vụ Labo");
  // Blind to case and marks, on the service's name (R-1051).
  await services.search.fill("dich vu tim vat lieu e2e");
  await services.row(GROUP).click();
  await services.popup.getByRole("button", { name: "Chọn dịch vụ" }).click();
  await expect(services.popup).toBeHidden();
}

test.describe("Labo dialog — Vật liệu search (R-1062)", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 900 });
    await login(page);
  });

  // F-91 (R-1198): tab Đặt hàng is now the Phiếu yêu cầu, which lists every
  // material of its groups as checkboxes — no Dịch vụ row, no Vật liệu popup to
  // search. Kept for the old form's history.
  test.skip("finds the material accent-blind in the popup, keeps the pick, saves the draft", async ({
    page,
  }) => {
    const target = await findStageablePatient(page);
    const seeded = await seedCatalog(page, target.branchId);

    await page.goto(`/patient/${target.patientId}?branchId=${target.branchId}&tab=labo`);
    await assertRealApiTraffic(page, "/api/v1/app/labo-orders");
    await page.locator(".pd-record-toolbar").getByRole("button", { name: "Tạo phiếu Labo" }).click();
    const dialog = page.getByRole("dialog").filter({ has: page.locator(".pd-labo-steps") });
    await expect(dialog.getByRole("heading", { level: 2 })).toHaveText("Đặt hàng");
    const rows = choiceRows(dialog);

    // ── Vật liệu waits for a service; then three chips and «Xem thêm» ────
    await expect(rows.material.locator(".pd-labo-choice-label")).toHaveText(/Vật liệu/);
    await expect(rows.material.locator(".pd-labo-emptypill")).toHaveText("Chọn dịch vụ trước");
    await expect(rows.more).toHaveCount(0);

    await pickGroup(page, dialog);
    await expect(rows.services.filter({ hasText: GROUP })).toHaveAttribute("aria-pressed", "true");
    await expect(rows.chips).toHaveCount(3);
    await expect(rows.more).toBeVisible();

    // ── Accent- and case-blind, on any part of the name (R-1051) ─────────
    await rows.more.click();
    const materials = choicePopup(page, "Chọn vật liệu");
    await expect(materials.popup.locator(".pd-labo-pick-count")).toHaveText("4 vật liệu");
    await expectNames(materials.names, [ZIRCONIA, EMAX, DENTURE, TITAN]);
    await materials.search.fill("zirconia");
    await expectNames(materials.names, [ZIRCONIA]);
    await materials.search.fill("su");
    await expectNames(materials.names, [ZIRCONIA, EMAX, TITAN]);
    await materials.search.fill("DUC");
    await expectNames(materials.names, [DENTURE]);
    await materials.search.fill("không có vật liệu này");
    await expect(materials.names).toHaveCount(0);
    await expect(materials.popup.locator(".pd-labo-pick-none")).toHaveText("Không có dữ liệu");

    // ── Enter in the box picks nothing and does not submit the form ──────
    await materials.search.fill("emax");
    await materials.search.press("Enter");
    // Validation runs async, so an absence is only worth checking after a beat.
    await page.waitForTimeout(800);
    await expect(dialog.locator(".ant-form-item-explain-error")).toHaveCount(0);
    await expect(materials.popup).toBeVisible();
    await expect(materials.popup.getByRole("button", { name: "Chọn vật liệu" })).toBeDisabled();

    // ── One pick (radio), applied only by the footer's button ────────────
    await materials.row(EMAX).click();
    await expect(materials.row(EMAX)).toHaveAttribute("aria-checked", "true");
    await expect(materials.popup.locator(".pd-labo-pick-foot")).toContainText(EMAX);
    await materials.popup.getByRole("button", { name: "Chọn vật liệu" }).click();
    await expect(materials.popup).toBeHidden();
    await expect(rows.chips.filter({ hasText: EMAX })).toHaveAttribute("aria-pressed", "true");

    // ── The popup opens on the pick; a pick past the first three still shows, last ─
    await rows.more.click();
    await expect(materials.search).toHaveValue("");
    await expect(materials.row(EMAX)).toHaveAttribute("aria-checked", "true");
    await materials.popup.getByRole("button", { name: "Hủy" }).click();
    await expect(materials.popup).toBeHidden();
    const shown = (await rows.chips.allTextContents()).map((text) => text.trim());
    const outside = [ZIRCONIA, EMAX, DENTURE, TITAN].find((name) => !shown.includes(name))!;
    await rows.more.click();
    await materials.row(outside).dblclick();
    await expect(materials.popup).toBeHidden();
    await expect(rows.chips).toHaveCount(3);
    await expect(rows.chips.nth(2)).toHaveText(outside);
    await expect(rows.chips.nth(2)).toHaveAttribute("aria-pressed", "true");

    // ── Another service lets go of the material ──────────────────────────
    const otherGroup = rows.services.filter({ hasNotText: GROUP }).first();
    if ((await otherGroup.count()) > 0) {
      await otherGroup.click();
      await expect(rows.material.locator('[aria-pressed="true"]')).toHaveCount(0);
      await pickGroup(page, dialog);
      await expect(rows.chips).toHaveCount(3);
      await expect(rows.material.locator('[aria-pressed="true"]')).toHaveCount(0);
    }

    // ── Picked through the popup, kept as a Nháp, read back after a reload ─
    await rows.more.click();
    await materials.search.fill("zircon");
    await materials.row(ZIRCONIA).click();
    await materials.popup.getByRole("button", { name: "Chọn vật liệu" }).click();
    await pickOption(page, field(dialog, "Dịch vụ điều trị"));
    await ensureDoctor(dialog, page);
    await pickOption(page, field(dialog, "Nhà cung cấp"), seeded.supplierName);
    const code = await dialog.locator("input[value^='LABO-']").inputValue();
    expect(code).toMatch(/^LABO-\d+$/);
    await dialog.locator(".pd-labo-footer").getByRole("button", { name: "Lưu nháp" }).click();
    await expect(page.getByText("Đã lưu nháp phiếu Labo")).toBeVisible();
    await expect(dialog).toBeHidden();

    await page.reload();
    await assertRealApiTraffic(page, "/api/v1/app/labo-orders");
    const row = rowsWithCode(page, code).first();
    await expect(row).toContainText(ZIRCONIA);
  });
});
