import { expect, test, type Locator, type Page } from "@playwright/test";
import { assertRealApiTraffic, login, runId } from "./fixtures/auth";

/**
 * Feature: hồ sơ bệnh nhân → tab Labo → dialog Đặt mới / Làm tiếp công đoạn /
 * Bảo hành (docs/clone/pages/patient-detail.md, Tab 6).
 *
 * Real stack: the browser logs in through the login screen, the dialog posts to
 * the real API, PostgreSQL keeps the rows, and every read-back is a fresh
 * request. The only shortcut is the seeding of a supplier and a material when
 * the clinic has none yet — done with the same cookie the browser holds, through
 * the same endpoints the Labo catalog screens call.
 */

interface Target {
  patientId: string;
  branchId: string;
}

interface Seeded {
  supplierName: string;
  groupName: string;
  materialName: string;
}

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

/**
 * The dialog cannot be saved without a supplier, and "Thay đổi vật liệu mới"
 * needs a material to pick. Both are created only when the branch has none.
 */
async function seedCatalog(page: Page, branchId: string, id: string): Promise<Seeded> {
  return page.evaluate(
    async ({ branchId, id }) => {
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
          name: `Labo e2e ${id}`,
          email: `labo-${id}@example.com`,
          clinicBranchId: branchId,
        }));

      const groups = await get(
        `/api/v1/app/taxonomies?ClinicBranchId=${branchId}&Group=labo_material&MaxResultCount=1`,
      );
      const group =
        groups.items[0] ??
        (await post("/api/v1/app/taxonomies", {
          group: "labo_material",
          name: `Dịch vụ e2e ${id}`,
          clinicBranchId: branchId,
        }));
      const materials = await get(
        `/api/v1/app/labo-materials?ClinicBranchId=${branchId}&TaxonomyId=${group.id}&MaxResultCount=1`,
      );
      const material =
        materials.items[0] ??
        (await post("/api/v1/app/labo-materials", {
          name: `Vật liệu e2e ${id}`,
          taxonomyId: group.id,
          clinicBranchId: branchId,
        }));
      return { supplierName: supplier.name, groupName: group.name, materialName: material.name };
    },
    { branchId, id },
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

/** Ngày nhận dự kiến, a week out; the picker is AntD's, typed and confirmed. */
async function fillDueDate(scope: Locator, page: Page) {
  const input = field(scope, "Ngày nhận dự kiến").locator("input");
  const due = new Date(Date.now() + 7 * 24 * 3600 * 1000);
  const day = String(due.getDate()).padStart(2, "0");
  const month = String(due.getMonth() + 1).padStart(2, "0");
  const text = `${day}/${month}/${due.getFullYear()}`;
  await input.click();
  await input.fill(text);
  await page.keyboard.press("Enter");
  await expect(input).toHaveValue(text);
}

/**
 * Giờ nhận, typed into AntD's time picker and confirmed with the panel's OK:
 * Enter here would also submit the form, which is not what this step tests.
 */
async function fillDueTime(scope: Locator, page: Page) {
  const input = field(scope, "Giờ nhận").locator("input");
  await input.click();
  await input.fill("09:30");
  await page.locator(".ant-picker-dropdown:visible .ant-picker-ok button").click();
  await expect(input).toHaveValue("09:30");
}

/** The reference's own wording under each field an empty Đặt mới leaves red. */
const EMPTY_NEW_ORDER_ERRORS = [
  "Vui lòng chọn kế hoạch điều trị.",
  "Vui lòng chọn dịch vụ điều trị.",
  "Vui lòng chọn bác sĩ chỉ định.",
  "Vui lòng chọn nhà cung cấp.",
  "Vui lòng chọn ngày nhận dự kiến.",
  "Vui lòng chọn giờ nhận.",
  "Vui lòng chọn dịch vụ Labo.",
  "Vui lòng chọn vật liệu.",
];

const PNG_1PX = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

/** How many labo orders the patient holds, read through the real API: the tab pages at 20. */
async function countPatientLaboOrders(page: Page, patientId: string): Promise<number> {
  return page.evaluate(async (id) => {
    const res = await fetch(`/api/v1/app/labo-orders?patientId=${id}&maxResultCount=1`, {
      credentials: "include",
    });
    return (await res.json()).totalCount as number;
  }, patientId);
}

/** How many pictures the patient's Hình ảnh holds, read through the real API. */
async function countPatientImages(page: Page, patientId: string): Promise<number> {
  return page.evaluate(async (id) => {
    const res = await fetch(`/api/v1/app/patient-images?patientId=${id}&maxResultCount=1`, {
      credentials: "include",
    });
    return (await res.json()).totalCount as number;
  }, patientId);
}

/**
 * Someone else saves a slip with the code the open dialog still shows — the
 * race behind R-312. A real POST with the browser's own cookie, the way the
 * other receptionist's dialog would send it.
 */
async function claimOrderCode(page: Page, target: Target, supplierName: string, code: string) {
  const saved = await page.evaluate(
    async ({ target, supplierName, code }) => {
      const xsrf = document.cookie
        .split("; ")
        .find((c) => c.startsWith("XSRF-TOKEN="))
        ?.substring("XSRF-TOKEN=".length);
      const res = await fetch("/api/v1/app/labo-orders", {
        method: "POST",
        credentials: "include",
        headers: {
          "content-type": "application/json",
          "X-Clinic-Branch-Id": target.branchId,
          ...(xsrf ? { RequestVerificationToken: decodeURIComponent(xsrf) } : {}),
        },
        body: JSON.stringify({
          patientId: target.patientId,
          branchId: target.branchId,
          labProviderName: supplierName,
          orderCode: code,
          kind: 1,
          estimatedCost: 0,
          quantity: 1,
        }),
      });
      if (!res.ok) throw new Error(`claim → ${res.status} ${await res.text()}`);
      return (await res.json()) as { orderCode: string };
    },
    { target, supplierName, code },
  );
  expect(saved.orderCode).toBe(code);
}

/**
 * Raise one plain Đặt mới order for the patient through the real API, the
 * code allocated by the server: fills the record up to the count a paging
 * test needs.
 */
async function raiseOrder(page: Page, target: Target, supplierName: string) {
  await page.evaluate(
    async ({ target, supplierName }) => {
      const xsrf = document.cookie
        .split("; ")
        .find((c) => c.startsWith("XSRF-TOKEN="))
        ?.substring("XSRF-TOKEN=".length);
      const res = await fetch("/api/v1/app/labo-orders", {
        method: "POST",
        credentials: "include",
        headers: {
          "content-type": "application/json",
          "X-Clinic-Branch-Id": target.branchId,
          ...(xsrf ? { RequestVerificationToken: decodeURIComponent(xsrf) } : {}),
        },
        body: JSON.stringify({
          patientId: target.patientId,
          branchId: target.branchId,
          labProviderName: supplierName,
          kind: 1,
          estimatedCost: 0,
          quantity: 1,
        }),
      });
      if (!res.ok) throw new Error(`raise → ${res.status} ${await res.text()}`);
    },
    { target, supplierName },
  );
}

interface LaboStats {
  total: number;
  new: number;
  continueStage: number;
  guarantee: number;
}

/** The three counters as the server counts them. */
async function readLaboStats(page: Page, patientId: string): Promise<LaboStats> {
  return page.evaluate(async (id) => {
    const res = await fetch(`/api/v1/app/labo-orders/stats?patientId=${id}`, {
      credentials: "include",
    });
    return (await res.json()) as LaboStats;
  }, patientId);
}

/** The list request the tab sends, matched on the paging and filter it carries. */
function laboListRequest(page: Page, query: Record<string, number>) {
  return page.waitForResponse((res) => {
    const url = new URL(res.url());
    if (!url.pathname.endsWith("/api/v1/app/labo-orders")) return false;
    return Object.entries(query).every(
      ([key, value]) => url.searchParams.get(key) === String(value),
    );
  });
}

/** "LABO-202609081" → "LABO-202609082": the code the server hands out next. */
function bumpOrderCode(code: string): string {
  const match = /^(LABO-\d{8})(\d+)$/.exec(code);
  expect(match, `order code ${code}`).toBeTruthy();
  return `${match![1]}${Number(match![2]) + 1}`;
}

/** The rows whose Mã phiếu cell is exactly this code: "…081" must not pick up "…0810". */
function rowsWithCode(page: Page, code: string) {
  return laboRows(page).filter({ has: page.locator("td", { hasText: new RegExp(`^${code}$`) }) });
}

function laboRows(page: Page) {
  return page.locator(".pd-pane--fill tbody tr.ant-table-row");
}

test.describe("Patient Labo tab", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 900 });
    await login(page);
  });

  test("Đặt mới, then Bảo hành on the row: same code, child pill, persisted", async ({ page }) => {
    const id = runId();
    const target = await findStageablePatient(page);
    const seeded = await seedCatalog(page, target.branchId, id);

    // ── The tab and its dialog live in the URL, as on the reference ─────
    await page.goto(`/patient/${target.patientId}?branchId=${target.branchId}&tab=labo`);
    await assertRealApiTraffic(page, "/api/v1/app/labo-orders");
    const ordersBefore = await countPatientLaboOrders(page, target.patientId);

    await page.getByRole("button", { name: "Tạo phiếu Labo" }).click();
    await expect(page).toHaveURL(/laboModal=new-order/);
    const dialog = page.getByRole("dialog", { name: "Đặt mới" });
    await expect(dialog).toBeVisible();
    await expect(dialog.locator(".pd-labo-tabs .pill-tab--active")).toHaveText("Đặt mới");

    // ── An empty Lưu: no toast, every required field wears the reference's
    //    red helper text (AntD rules through the app's FloatingField) ──────
    await expect(field(dialog, "Số lượng").locator("input")).toHaveValue("0");
    await dialog.locator(".pd-labo-footer").getByRole("button", { name: "Lưu" }).click();
    for (const message of EMPTY_NEW_ORDER_ERRORS) {
      await expect(
        dialog.locator(".ant-form-item-explain-error", { hasText: message }),
      ).toBeVisible();
    }
    await expect(dialog.locator(".pd-labo-strip--error")).toHaveCount(2);
    await expect(field(dialog, "Nhà cung cấp").locator(".floating-field-label")).toHaveCSS(
      "color",
      "rgb(229, 72, 77)",
    );
    await expect(dialog).toBeVisible();

    // ── Đặt mới: open line first (names its plan) → supplier → due date ──
    await pickOption(page, field(dialog, "Dịch vụ điều trị"));
    await expect(field(dialog, "Kế hoạch điều trị")).toHaveClass(/floating-field--floated/);
    // The line names its plan and doctor, and their errors go with the values.
    for (const message of EMPTY_NEW_ORDER_ERRORS.slice(0, 3)) {
      await expect(
        dialog.locator(".ant-form-item-explain-error", { hasText: message }),
      ).toBeHidden();
    }
    // Số lượng is the count of ticked teeth: every tooth of the line at first,
    // 0 once "Chọn tất cả" is unticked, the count again once it is ticked back.
    const teethChips = dialog.locator(".pd-labo-teeth button");
    const teethCount = await teethChips.count();
    await expect(field(dialog, "Số lượng").locator("input")).toHaveValue(String(teethCount));
    if (teethCount > 0) {
      // click(), not uncheck(): the controlled box follows the form's watch a
      // tick after the click, and uncheck() reads its state right away.
      const allTeeth = dialog.getByRole("checkbox", { name: "Chọn tất cả" });
      await allTeeth.click();
      await expect(field(dialog, "Số lượng").locator("input")).toHaveValue("0");
      await expect(allTeeth).not.toBeChecked();
      // With the line's teeth all unticked, Lưu stops at the row (R-311) and
      // the next tick clears the line again.
      const teethError = dialog.locator(".ant-form-item-explain-error", {
        hasText: "Vui lòng chọn răng.",
      });
      await dialog.locator(".pd-labo-footer").getByRole("button", { name: "Lưu" }).click();
      await expect(teethError).toBeVisible();
      await expect(dialog.locator(".pd-labo-teeth--error")).toHaveCount(1);
      await allTeeth.click();
      await expect(field(dialog, "Số lượng").locator("input")).toHaveValue(String(teethCount));
      await expect(allTeeth).toBeChecked();
      await expect(teethError).toBeHidden();
    }
    // Clearing the line takes the teeth with it: the row goes back to the
    // reference's plain "Chọn dịch vụ điều trị trước", tick box and all (R-310).
    await field(dialog, "Dịch vụ điều trị").locator(".ss-icon--clear").click();
    await expect(dialog.locator(".pd-labo-teeth")).toContainText("Chọn dịch vụ điều trị trước");
    await expect(dialog.getByRole("checkbox", { name: "Chọn tất cả" })).toHaveCount(0);
    await expect(teethChips).toHaveCount(0);
    await expect(field(dialog, "Số lượng").locator("input")).toHaveValue("0");
    await pickOption(page, field(dialog, "Dịch vụ điều trị"));
    await expect(teethChips).toHaveCount(teethCount);
    // The native picker behind "Tải ảnh" stays hidden inside the AntD form (R-309).
    await expect(dialog.locator('input[type="file"]')).toBeHidden();
    await expect(dialog.getByRole("button", { name: "Tải ảnh" })).toBeVisible();
    // A picture picked here is uploaded on Lưu into the patient's Hình ảnh (R-311).
    const imagesBefore = await countPatientImages(page, target.patientId);
    await dialog
      .locator('input[type="file"]')
      .setInputFiles([{ name: `labo-${id}.png`, mimeType: "image/png", buffer: PNG_1PX }]);
    await expect(dialog.locator(".pd-labo-drafts > div")).toHaveCount(1);
    // The doctor follows the line but stays a select; code and quantity are locked, as on the reference.
    await expect(field(dialog, "Bác sĩ chỉ định")).toHaveClass(/floating-field--floated/);
    await expect(field(dialog, "Bác sĩ chỉ định").locator(".ss-trigger")).toBeVisible();
    await expect(field(dialog, "Số phiếu Labo").locator("input")).toBeDisabled();
    await expect(field(dialog, "Số lượng").locator("input")).toBeDisabled();
    const heldCode = await field(dialog, "Số phiếu Labo").locator("input").inputValue();
    expect(heldCode).toMatch(/^LABO-\d+$/);
    // Meanwhile another slip takes that code (R-312): Lưu below must still go
    // through, on the next code, instead of the unique index's 500.
    await claimOrderCode(page, target, seeded.supplierName, heldCode);
    const code = bumpOrderCode(heldCode);

    await pickOption(page, field(dialog, "Nhà cung cấp"), seeded.supplierName);
    await fillDueDate(dialog, page);
    await fillDueTime(dialog, page);
    const newStrips = dialog.locator(".pd-labo-strip");
    // Each strip with chips carries the reference's pair of round arrows (R-310).
    await expect(newStrips.nth(0).locator(".pd-labo-arrow")).toHaveCount(2);
    const serviceChip = newStrips.nth(0).locator(".pd-labo-chips button").first();
    await serviceChip.click();
    await expect(serviceChip).toHaveAttribute("aria-pressed", "true");
    // A second click lets the choice go, and the material strip waits again.
    await serviceChip.click();
    await expect(serviceChip).toHaveAttribute("aria-pressed", "false");
    await expect(newStrips.nth(1)).toContainText("Chọn dịch vụ trước");
    await serviceChip.click();
    await expect(newStrips.nth(1).locator(".pd-labo-arrow")).toHaveCount(2);
    await newStrips
      .nth(1)
      .locator(".pd-labo-chips button", { hasText: seeded.materialName })
      .click();
    await expect(dialog.locator(".ant-form-item-explain-error")).toHaveCount(0);
    await dialog.locator(".pd-labo-footer").getByRole("button", { name: "Lưu" }).click();

    await expect(page.getByText("Đã tạo phiếu Labo")).toBeVisible();
    await expect(dialog).toBeHidden();
    await expect(page).not.toHaveURL(/laboModal=/);

    // The claimed slip and the dialog's, each on its own code; newest first,
    // so both sit on the first page whatever the patient already had.
    expect(await countPatientLaboOrders(page, target.patientId)).toBe(ordersBefore + 2);
    await expect(rowsWithCode(page, heldCode)).toHaveCount(1);
    expect(await countPatientImages(page, target.patientId)).toBe(imagesBefore + 1);
    const parentRow = rowsWithCode(page, code).first();
    await expect(parentRow).toBeVisible();
    await expect(parentRow).toContainText("Mẫu mới");
    await expect(parentRow).toContainText(seeded.supplierName);

    // ── Bảo hành from the row: URL carries the parent, the code is locked ─
    await parentRow.getByRole("button", { name: "Bảo hành" }).click();
    await expect(page).toHaveURL(/laboModal=warranty/);
    await expect(page).toHaveURL(/laboRowId=[0-9a-f-]{36}/);
    const warranty = page.getByRole("dialog", { name: "Bảo hành" });
    await expect(warranty).toBeVisible();
    await expect(warranty.locator(".pd-labo-tabs .pill-tab--active")).toHaveText("Bảo hành");
    await expect(field(warranty, "Phiếu dịch vụ Labo")).toContainText(`#${code}`);
    const codeInput = field(warranty, "Số phiếu Labo").locator("input");
    await expect(codeInput).toBeDisabled();
    await expect(codeInput).toHaveValue(code);
    await expect(warranty.getByText("Ngày bảo hành")).toBeVisible();
    await expect(warranty.getByRole("radio", { name: "Theo vật liệu cũ" })).toBeChecked();

    // The child opens with the parent's doctor and supplier; only the due stamp
    // is missing, and Lưu says so under those two fields, not in a toast.
    await expect(field(warranty, "Bác sĩ chỉ định")).toHaveClass(/floating-field--floated/);
    await expect(field(warranty, "Nhà cung cấp")).toContainText(seeded.supplierName);
    // The line's catalog service and the parent's labo service / material are
    // named from the server, not left blank (R-316).
    await expect(field(warranty, "Dịch vụ điều trị").locator("input")).not.toHaveValue("");
    const summary = warranty.locator(".pd-labo-summary");
    await expect(summary).toContainText(`Dịch vụ hiện tại: ${seeded.groupName}`);
    await expect(summary).toContainText(`Vật liệu: ${seeded.materialName}`);
    await warranty.locator(".pd-labo-footer").getByRole("button", { name: "Lưu" }).click();
    await expect(
      warranty.locator(".ant-form-item-explain-error", {
        hasText: "Vui lòng chọn ngày nhận dự kiến.",
      }),
    ).toBeVisible();
    await expect(
      warranty.locator(".ant-form-item-explain-error", { hasText: "Vui lòng chọn giờ nhận." }),
    ).toBeVisible();
    await expect(warranty.locator(".ant-form-item-explain-error")).toHaveCount(2);
    await expect(warranty).toBeVisible();

    // Switching tabs keeps the parent in the URL; switching back keeps it too.
    await warranty.locator(".pd-labo-tabs .pill-tab", { hasText: "Làm tiếp công đoạn" }).click();
    await expect(page).toHaveURL(/laboModal=continue-process/);
    await expect(page).toHaveURL(/laboRowId=/);
    await expect(page.getByRole("dialog", { name: "Làm tiếp công đoạn" })).toBeVisible();
    await page.locator(".pd-labo-tabs .pill-tab", { hasText: "Bảo hành" }).click();
    await expect(page).toHaveURL(/laboModal=warranty/);

    // ── Thay đổi vật liệu mới: pick the chips, save ──────────────────────
    await warranty.getByRole("radio", { name: "Thay đổi vật liệu mới" }).check();
    const strips = warranty.locator(".pd-labo-strip");
    await strips.nth(0).locator(".pd-labo-chips button").first().click();
    await strips.nth(1).locator(".pd-labo-chips button", { hasText: seeded.materialName }).click();
    await fillDueDate(warranty, page);
    await fillDueTime(warranty, page);
    await warranty.locator(".pd-labo-footer").getByRole("button", { name: "Lưu" }).click();

    await expect(page.getByText("Đã tạo phiếu Labo")).toBeVisible();
    await expect(warranty).toBeHidden();
    await expect(page).not.toHaveURL(/laboModal=|laboRowId=/);

    // Two rows wear the same code now: the parent and its warranty child.
    const sameCode = rowsWithCode(page, code);
    await expect(sameCode).toHaveCount(2);
    const child = sameCode.filter({ hasText: "Bảo hành" }).first();
    await expect(child).toBeVisible();
    await expect(child).toContainText(seeded.materialName);

    // ── Persisted: a reload reads both rows back from the server ─────────
    await page.reload();
    await assertRealApiTraffic(page, "/api/v1/app/labo-orders");
    await expect(rowsWithCode(page, code)).toHaveCount(2);
  });

  test("closing the dialog clears both URL params", async ({ page }) => {
    const target = await findStageablePatient(page);
    await page.goto(
      `/patient/${target.patientId}?branchId=${target.branchId}&tab=labo&laboModal=warranty`,
    );
    const dialog = page.getByRole("dialog", { name: "Bảo hành" });
    await expect(dialog).toBeVisible();
    // Nothing picked yet: the form waits for a parent and Lưu is off.
    await expect(
      dialog.locator(".pd-labo-footer").getByRole("button", { name: "Lưu" }),
    ).toBeDisabled();

    await dialog.locator(".ant-modal-close").click();
    await expect(dialog).toBeHidden();
    await expect(page).not.toHaveURL(/laboModal=|laboRowId=/);
    await expect(page).toHaveURL(/tab=labo/);
  });

  test("pages, counts and filters on the server, not on the page", async ({ page }) => {
    const target = await findStageablePatient(page);
    const seeded = await seedCatalog(page, target.branchId, runId());

    // Two pages of ten: the record is topped up through the real API.
    const PAGE = 10;
    const ordersBefore = await countPatientLaboOrders(page, target.patientId);
    for (let n = ordersBefore; n < PAGE + 1; n++) {
      await raiseOrder(page, target, seeded.supplierName);
    }
    const stats = await readLaboStats(page, target.patientId);
    const total = stats.total;
    expect(total).toBeGreaterThan(PAGE);

    await page.goto(`/patient/${target.patientId}?branchId=${target.branchId}&tab=labo`);
    await assertRealApiTraffic(page, "/api/v1/app/labo-orders");
    const pane = page.locator(".pd-pane--fill");
    const counters = pane.locator(".pd-stat");
    const pagerText = pane.locator(".ant-pagination-total-text");

    // ── The counters are the server's, over the whole record ──────────────
    await expect(counters.nth(0).locator("strong")).toHaveText(String(stats.new));
    await expect(counters.nth(1).locator("strong")).toHaveText(String(stats.continueStage));
    await expect(counters.nth(2).locator("strong")).toHaveText(String(stats.guarantee));

    // ── Page size 10: the server is asked for ten from the top ────────────
    const firstPage = laboListRequest(page, { skipCount: 0, maxResultCount: PAGE });
    await pane.locator(".ant-pagination-options .ant-select").click();
    await page.getByRole("option", { name: `${PAGE} / trang`, exact: true }).click();
    await firstPage;
    await expect(laboRows(page)).toHaveCount(PAGE);
    await expect(pagerText).toHaveText(`Hiển thị 1–${PAGE} trên ${total} phiếu labo`);

    // ── Page 2: the server is asked for the next ten, not the same fifty ──
    const secondPage = laboListRequest(page, { skipCount: PAGE, maxResultCount: PAGE });
    await pane.locator(".ant-pagination-item-2").click();
    await secondPage;
    const onSecond = Math.min(PAGE, total - PAGE);
    await expect(laboRows(page)).toHaveCount(onSecond);
    await expect(pagerText).toHaveText(
      `Hiển thị ${PAGE + 1}–${PAGE + onSecond} trên ${total} phiếu labo`,
    );

    // ── A counter filters on the server and goes back to page 1 ──────────
    const filtered = laboListRequest(page, { kind: 1, skipCount: 0, maxResultCount: PAGE });
    await counters.nth(0).click();
    await filtered;
    await expect(counters.nth(0)).toHaveAttribute("aria-pressed", "true");
    await expect(pagerText).toContainText(`trên ${stats.new} phiếu labo`);
    await expect(laboRows(page)).toHaveCount(Math.min(PAGE, stats.new));
    // Every row on the page is a Mẫu mới; the counters still count the whole record.
    await expect(
      laboRows(page).locator("td:nth-child(2)").filter({ hasNotText: "Mẫu mới" }),
    ).toHaveCount(0);
    await expect(counters.nth(0).locator("strong")).toHaveText(String(stats.new));
    await expect(counters.nth(1).locator("strong")).toHaveText(String(stats.continueStage));

    // ── Pressing it again clears the filter. No request to wait for: the
    //    unfiltered page comes back from the query cache, as on the reference.
    await counters.nth(0).click();
    await expect(counters.nth(0)).toHaveAttribute("aria-pressed", "false");
    await expect(pagerText).toHaveText(`Hiển thị 1–${PAGE} trên ${total} phiếu labo`);
  });
});
