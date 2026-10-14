import { expect, test, type Browser, type Locator, type Page } from "@playwright/test";
import { assertRealApiTraffic, login, runId } from "./fixtures/auth";
import { call } from "./fixtures/timekeepingStaff";

/**
 * BA #34 — "Thêm nhanh dịch vụ": a round + beside "Tìm dịch vụ" in "Chọn Dịch
 * Vụ" adds a missing service to the catalog without a trip to Danh mục. It
 * opens Danh mục's own dialog; on the Combo tab, the combo dialog. The saved
 * entry comes back ticked and is saved as an advise line like any other.
 *
 * Real login screen, real API, real PostgreSQL; nothing is intercepted. Each
 * run makes its own patient, and the permission test its own role and staff.
 */

const BRANCH_ONE = "11111111-1111-1111-1111-111111111111";
const ENTRIES = "/api/v1/app/catalog-entries";
const ADVISES = "/api/v1/app/patient-advises";
const PASSWORD = "NhanhDv@123456";
const QUICK_SERVICE = "Thêm nhanh dịch vụ";
const QUICK_COMBO = "Thêm nhanh combo";
/** Enough to write a slip and pick services for it — but not to add to the catalog. */
const ADVISE_ONLY = [
  "BlueDental.patient.read",
  "BlueDental.treatmentDiagnosis.read",
  "BlueDental.treatmentConsultation.read",
  "BlueDental.treatmentConsultation.create",
  "BlueDental.catalogService.read",
];

interface Entry {
  id: string;
  name: string;
  taxonomyId: string;
  price: number | null;
  isCombo: boolean;
}

interface Advise {
  id: string;
  serviceId: string;
  price: number;
}

const money = (value: number) => `${value.toLocaleString("vi-VN")} đ`;
const savedAdvise = (page: Page) =>
  page.waitForResponse((res) => res.request().method() === "POST" && res.url().includes(ADVISES));
const postedEntry = (page: Page) =>
  page.waitForResponse((res) => res.request().method() === "POST" && res.url().endsWith(ENTRIES));

/** A fresh patient with one diagnosis slip, made through the API as admin. */
async function patientWithSlip(page: Page, id: string): Promise<string> {
  const patient = await call<{ id: string }>(page, "/api/v1/app/patients", {
    method: "POST",
    branchId: BRANCH_ONE,
    json: {
      firstName: "Nhanh",
      lastName: `Dịch Vụ E2E ${id}`,
      gender: 1,
      phoneNumber: `08${id}${String(Date.now()).slice(-2)}`,
      dateOfBirth: "1990-05-05",
    },
  });
  expect(patient.status, JSON.stringify(patient.body)).toBe(200);

  const diagnoses = await call<{ items: Entry[] }>(
    page,
    `${ENTRIES}?clinicBranchId=${BRANCH_ONE}&group=diagnosis&isActive=true&maxResultCount=1`,
    { branchId: BRANCH_ONE },
  );
  const staff = await call<{ items: { id: string }[] }>(page, "/api/v1/app/staff?MaxResultCount=1", {
    branchId: BRANCH_ONE,
  });
  const slip = await call(page, "/api/v1/app/patient-diagnoses", {
    method: "POST",
    branchId: BRANCH_ONE,
    json: {
      patientId: patient.body.id,
      clinicBranchId: BRANCH_ONE,
      diagnosisId: diagnoses.body.items[0].id,
      staffId: staff.body.items[0].id,
      note: `e2e thêm nhanh ${id}`,
      teeth: [{ toothCode: 21, selected: true, top: false, right: false, bottom: false, left: false, center: false }],
    },
  });
  expect(slip.status, JSON.stringify(slip.body)).toBe(200);
  return patient.body.id;
}

async function openPicker(page: Page, patientId: string): Promise<Locator> {
  await page.goto(`/patient/${patientId}?tab=consulting&branchId=${BRANCH_ONE}`);
  const slipRow = page.locator(".pd-diagnosis-card tbody tr.ant-table-row").first();
  await expect(slipRow).toBeVisible({ timeout: 20_000 });
  await slipRow.getByRole("button", { name: "Tạo Dịch Vụ" }).click();
  const dialog = page.getByRole("dialog", { name: /Chọn Dịch Vụ/ });
  await expect(dialog).toBeVisible();
  return dialog;
}

async function openSession(browser: Browser, userName: string) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await login(page, { userName, password: PASSWORD });
  return { context, page };
}

test.describe("Thêm nhanh dịch vụ (BA #34)", () => {
  test.describe.configure({ timeout: 120_000 });

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1700, height: 1000 });
    await login(page);
  });

  test("the + adds a service through Danh mục's dialog, ticks it, and the advise saves with it", async ({
    page,
  }) => {
    const id = runId();
    const name = `e2e Dịch vụ nhanh ${id}`;
    const patientId = await patientWithSlip(page, id);
    const served = assertRealApiTraffic(page, ENTRIES);
    const dialog = await openPicker(page, patientId);
    await served;

    // The + sits beside "Tìm dịch vụ" and says what it does.
    const quick = dialog.getByRole("button", { name: QUICK_SERVICE });
    await expect(quick).toBeEnabled();
    await quick.hover();
    await expect(page.getByRole("tooltip")).toHaveText(QUICK_SERVICE);
    await quick.click();

    // Danh mục's "Thêm dịch vụ", already on a group, with no Loại switch.
    const form = page.getByRole("dialog", { name: "Thêm dịch vụ" });
    await expect(form).toBeVisible();
    await expect(form.getByText("Thành phần combo")).toHaveCount(0);
    await form.getByRole("textbox", { name: /^Dịch vụ/ }).fill(name);
    await form.getByLabel(/^Giá$/).fill("420000");

    const created = postedEntry(page);
    await form.getByRole("button", { name: "Lưu" }).click();
    const response = await created;
    expect(response.status()).toBe(200);
    const entry = (await response.json()) as Entry;
    expect(entry.name).toBe(name);
    expect(entry.price).toBe(420_000);
    expect(entry.isCombo).toBe(false);
    await expect(form).toBeHidden();

    // BA: it comes back ticked, in the summary and in its group's list.
    const summary = page.locator(".am-summary");
    await expect(summary.locator(".am-summary-items li")).toHaveCount(1);
    await expect(summary).toContainText(name);
    await expect(summary.locator(".am-summary-total")).toHaveText(money(420_000));
    const row = dialog.locator(".am-table tbody tr", { hasText: name });
    await expect(row).toBeVisible({ timeout: 15_000 });
    await expect(row.getByRole("checkbox")).toBeChecked();

    // The same name again is refused by the server, and the dialog stays open.
    await quick.click();
    await expect(form).toBeVisible();
    await form.getByRole("textbox", { name: /^Dịch vụ/ }).fill(name);
    const refused = postedEntry(page);
    await form.getByRole("button", { name: "Lưu" }).click();
    expect((await refused).status()).toBeGreaterThanOrEqual(400);
    await expect(form).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(form).toBeHidden();
    await expect(summary.locator(".am-summary-items li")).toHaveCount(1);

    // Lưu stores the new service as the advise line, and it is there after a reload.
    const saved = savedAdvise(page);
    await dialog.getByRole("button", { name: /Lưu/ }).click();
    const advise = (await (await saved).json()) as Advise;
    expect(advise.serviceId).toBe(entry.id);
    expect(advise.price).toBe(420_000);
    await expect(dialog).toBeHidden();

    await page.reload();
    const line = page.locator(`.pd-advise-table tbody tr[data-row-key="${advise.id}"]`);
    await expect(line).toBeVisible({ timeout: 20_000 });
    await expect(line).toContainText(name);

    // Danh mục has it too, in the group the dialog chose.
    const listed = await call<{ items: Entry[] }>(
      page,
      `${ENTRIES}?group=care_service&clinicBranchId=${BRANCH_ONE}&filter=${encodeURIComponent(name)}`,
      { branchId: BRANCH_ONE },
    );
    expect(listed.body.items.map((item) => [item.id, item.taxonomyId])).toEqual([[entry.id, entry.taxonomyId]]);
  });

  test("on the Combo tab the + adds a combo, picks it, and the advise saves it as one line", async ({ page }) => {
    const id = runId();
    const comboName = `e2e Combo nhanh ${id}`;
    const patientId = await patientWithSlip(page, id);
    const groups = await call<{ items: { id: string }[] }>(
      page,
      `/api/v1/app/taxonomies?ClinicBranchId=${BRANCH_ONE}&Group=care_service&MaxResultCount=1`,
      { branchId: BRANCH_ONE },
    );
    const part = await call<Entry>(page, ENTRIES, {
      method: "POST",
      branchId: BRANCH_ONE,
      json: {
        clinicBranchId: BRANCH_ONE,
        taxonomyId: groups.body.items[0].id,
        name: `e2e thành phần nhanh ${id}`,
        price: 300_000,
        stages: [],
      },
    });
    expect(part.status, JSON.stringify(part.body)).toBe(200);

    const dialog = await openPicker(page, patientId);
    // A ticked service is dropped when a combo is picked — as with any combo.
    await dialog.getByPlaceholder("Tìm dịch vụ").fill(part.body.name);
    await dialog.locator(".am-table tbody tr", { hasText: part.body.name }).getByRole("checkbox").check();

    await dialog.getByRole("tab", { name: /Combo/ }).click();
    await expect(dialog.getByRole("button", { name: QUICK_SERVICE })).toHaveCount(0);
    await dialog.getByRole("button", { name: QUICK_COMBO }).click();

    const comboDialog = page.locator(".bd-combo-dialog");
    await expect(comboDialog.getByText("Thành phần combo")).toBeVisible();
    // Drawn as in Danh mục even when Danh mục was never opened: the picker
    // beside the parts, its groups one sideways row (not a wall of chips).
    await expect(comboDialog.locator(".bd-combo-layout")).toHaveCSS("display", "grid");
    const groupRow = comboDialog.locator(".bd-combo-picker-groups");
    await expect(groupRow).toHaveCSS("overflow-x", "auto");
    expect((await groupRow.boundingBox())?.height ?? 0).toBeLessThan(60);
    const search = comboDialog.getByPlaceholder("Tìm theo tên...");
    await search.fill(part.body.name);
    const add = comboDialog.getByRole("button", { name: `Thêm ${part.body.name} vào combo` });
    await add.click();
    await add.click();
    await expect(comboDialog.locator(".bd-combo-picker-badge")).toHaveText("+2 trong combo");
    await comboDialog.getByRole("textbox", { name: "Tên combo" }).fill(comboName);

    const created = postedEntry(page);
    await comboDialog.getByRole("button", { name: "Lưu combo" }).click();
    const response = await created;
    expect(response.status()).toBe(200);
    const combo = (await response.json()) as Entry;
    expect(combo.isCombo).toBe(true);
    expect(combo.price).toBe(600_000);
    await expect(comboDialog).toBeHidden();

    // Picked at once: its card says "Hủy dịch vụ", and it alone is in the summary.
    const summary = page.locator(".am-summary");
    await expect(summary.locator(".am-summary-items li")).toHaveCount(1);
    await expect(summary).toContainText(comboName);
    await expect(summary).not.toContainText(part.body.name);
    await expect(summary.locator(".am-summary-total")).toHaveText(money(600_000));
    const card = dialog.getByRole("article", { name: comboName });
    await expect(card).toBeVisible({ timeout: 15_000 });
    await expect(card.getByRole("button", { name: "Hủy dịch vụ" })).toBeVisible();

    const saved = savedAdvise(page);
    await dialog.getByRole("button", { name: /Lưu/ }).click();
    const advise = (await (await saved).json()) as Advise;
    expect(advise.serviceId).toBe(combo.id);
    expect(advise.price).toBe(600_000);
    await expect(dialog).toBeHidden();

    await page.reload();
    const line = page.locator(`.pd-advise-table tbody tr[data-row-key="${advise.id}"]`);
    await expect(line).toBeVisible({ timeout: 20_000 });
    await expect(line).toContainText(comboName);
  });

  test("without the right to add to Dịch vụ there is no +, and the server refuses too", async ({
    page,
    browser,
  }) => {
    const id = runId();
    const roleName = `Chỉ tư vấn ${id}`;
    const role = await call<{ id: string }>(page, "/api/identity/roles", {
      method: "POST",
      json: { name: roleName, isDefault: false, isPublic: true },
    });
    expect(role.status).toBe(200);
    const grants = await call(
      page,
      `/api/permission-management/permissions?providerName=R&providerKey=${encodeURIComponent(roleName)}`,
      { method: "PUT", json: { permissions: ADVISE_ONLY.map((n) => ({ name: n, isGranted: true })) } },
    );
    expect(grants.status).toBe(204);

    const userName = `nhanhdv${id}`;
    const staff = await call<{ id: string }>(page, "/api/v1/app/staff", {
      method: "POST",
      json: {
        userName,
        password: PASSWORD,
        name: `Nhân viên chỉ tư vấn ${id}`,
        email: `${userName}@bluedental.local`,
        roleNames: [roleName],
        branchIds: [BRANCH_ONE],
        isActive: true,
      },
    });
    expect(staff.status, JSON.stringify(staff.body)).toBe(200);
    const patientId = await patientWithSlip(page, id);
    const groups = await call<{ items: { id: string }[] }>(
      page,
      `/api/v1/app/taxonomies?ClinicBranchId=${BRANCH_ONE}&Group=care_service&MaxResultCount=1`,
      { branchId: BRANCH_ONE },
    );

    const limited = await openSession(browser, userName);
    try {
      await limited.page.setViewportSize({ width: 1700, height: 1000 });
      const dialog = await openPicker(limited.page, patientId);
      // The search is there to pick from; the + that adds to the catalog is not.
      await expect(dialog.getByPlaceholder("Tìm dịch vụ")).toBeVisible();
      await expect(dialog.locator(".am-table tbody tr").first()).toBeVisible({ timeout: 15_000 });
      await expect(dialog.getByRole("button", { name: QUICK_SERVICE })).toHaveCount(0);
      await dialog.getByRole("tab", { name: /Combo/ }).click();
      await expect(dialog.getByRole("button", { name: QUICK_COMBO })).toHaveCount(0);

      const refused = await call(limited.page, ENTRIES, {
        method: "POST",
        branchId: BRANCH_ONE,
        json: {
          clinicBranchId: BRANCH_ONE,
          taxonomyId: groups.body.items[0].id,
          name: `Không được thêm ${id}`,
          price: 1000,
          stages: [],
        },
      });
      expect(refused.status).toBe(403);
    } finally {
      await limited.context.close();
      await call(page, `/api/v1/app/staff/${staff.body.id}`, { method: "DELETE" });
      await call(page, `/api/identity/roles/${role.body.id}`, { method: "DELETE" });
    }
  });
});
