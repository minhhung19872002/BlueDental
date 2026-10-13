import { expect, test, type Browser, type Locator, type Page } from "@playwright/test";
import { assertRealApiTraffic, login, runId } from "./fixtures/auth";
import { call } from "./fixtures/timekeepingStaff";

/**
 * QA #28 — "Thêm nhanh chẩn đoán": a round + beside the diagnosis picker of
 * "Tạo chẩn đoán" files a new diagnosis in the catalog without a trip to Danh
 * mục, and the new entry is selected at once (BA).
 *
 * Real login screen, real API, real PostgreSQL; nothing is intercepted. Each
 * run makes its own patient, and the permission test its own role and staff.
 */

const BRANCH_ONE = "11111111-1111-1111-1111-111111111111";
const ENTRIES = "/api/v1/app/catalog-entries";
const PASSWORD = "NhanhCd@123456";
const QUICK = "Thêm mới chẩn đoán vào danh mục";
/** Danh mục's own "Thêm chẩn đoán" dialog, reused beside the picker. */
const DIALOG = "Thêm chẩn đoán";
/** Enough to open the consulting tab and write a slip — but not to add to the catalog. */
const SLIP_ONLY = [
  "BlueDental.patient.read",
  "BlueDental.treatmentDiagnosis.read",
  "BlueDental.treatmentDiagnosis.create",
  "BlueDental.catalogDiagnosis.read",
];

interface CatalogEntry {
  id: string;
  name: string;
  taxonomyId: string;
}

async function createPatient(page: Page, id: string): Promise<string> {
  const patient = await call<{ id: string }>(page, "/api/v1/app/patients", {
    method: "POST",
    branchId: BRANCH_ONE,
    json: {
      firstName: "Nhanh",
      lastName: `Chẩn Đoán E2E ${id}`,
      gender: 1,
      phoneNumber: `09${id}${String(Date.now()).slice(-2)}`,
      dateOfBirth: "1990-05-05",
    },
  });
  expect(patient.status, JSON.stringify(patient.body)).toBe(200);
  return patient.body.id;
}

async function openDiagnosisForm(page: Page, patientId: string): Promise<Locator> {
  const served = assertRealApiTraffic(page, "/api/v1/app/patient-diagnoses");
  await page.goto(`/patient/${patientId}?branchId=${BRANCH_ONE}&tab=consulting`);
  await served;
  await page.locator(".pd-diagnosis-card .pd-card-title").getByRole("button").click();
  const form = page.getByTestId("diagnosis-form");
  await expect(form).toBeVisible();
  return form;
}

async function pickFirstOption(page: Page, combobox: Locator): Promise<void> {
  await combobox.click();
  const option = page
    .locator(".ant-select-dropdown:not(.ant-select-dropdown-hidden)")
    .last()
    .locator(".ant-select-item-option")
    .first();
  await expect(option).toBeVisible();
  await option.click();
}

async function openSession(browser: Browser, userName: string) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await login(page, { userName, password: PASSWORD });
  return { context, page };
}

test.describe("Thêm nhanh chẩn đoán (QA #28)", () => {
  test.describe.configure({ timeout: 120_000 });

  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("the + files a diagnosis in the catalog, selects it, and the slip saves with it", async ({
    page,
  }) => {
    const id = runId();
    const name = `Chẩn đoán nhanh E2E ${id}`;
    const patientId = await createPatient(page, id);
    const form = await openDiagnosisForm(page, patientId);

    await form.getByRole("button", { name: QUICK }).hover();
    await expect(page.getByRole("tooltip")).toHaveText("Thêm chẩn đoán");
    await form.getByRole("button", { name: QUICK }).click();
    const dialog = page.getByRole("dialog", { name: DIALOG });
    await expect(dialog).toBeVisible();
    // A group is already chosen, so a name alone makes it saveable.
    await expect(dialog.locator(".ant-select-content-has-value")).toHaveCount(1);
    const save = dialog.getByRole("button", { name: "Lưu" });
    await expect(save).toBeDisabled();
    await dialog.getByRole("textbox").first().fill(name);
    await expect(save).toBeEnabled();

    const created = page.waitForResponse(
      (res) => res.request().method() === "POST" && res.url().endsWith(ENTRIES),
    );
    await save.click();
    const response = await created;
    expect(response.ok()).toBeTruthy();
    const entry = (await response.json()) as CatalogEntry;
    expect(entry.name).toBe(name);

    // BA: the new diagnosis is the one picked, straight away.
    await expect(dialog).toBeHidden();
    await expect(form.locator(".pd-diagnosis-pick .ant-select-content-has-value")).toHaveText(name);

    // The same name again in the same group is refused, and the dialog stays.
    await form.getByRole("button", { name: QUICK }).click();
    await expect(dialog).toBeVisible();
    await dialog.getByRole("textbox").first().fill(name);
    const refused = page.waitForResponse(
      (res) => res.request().method() === "POST" && res.url().endsWith(ENTRIES),
    );
    await dialog.getByRole("button", { name: "Lưu" }).click();
    expect((await refused).status()).toBeGreaterThanOrEqual(400);
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(form.locator(".pd-diagnosis-pick .ant-select-content-has-value")).toHaveText(name);

    // The slip goes out with the new diagnosis and comes back with it after a reload.
    await pickFirstOption(page, form.getByRole("combobox", { name: "Bác sĩ chẩn đoán 1" }));
    await page.getByRole("button", { name: "Răng 11", exact: true }).click();
    const slip = page.waitForResponse(
      (res) =>
        res.request().method() === "POST" && res.url().includes("/api/v1/app/patient-diagnoses"),
    );
    await form.getByRole("button", { name: "Lưu Chẩn Đoán" }).click();
    const slipResponse = await slip;
    expect(slipResponse.ok()).toBeTruthy();
    expect(((await slipResponse.json()) as { diagnosisId: string }).diagnosisId).toBe(entry.id);

    const rows = page.locator(".pd-diagnosis-card tbody tr.ant-table-row");
    await expect(rows.first()).toContainText(name);
    await page.reload();
    await expect(page.locator(".pd-diagnosis-card tbody tr.ant-table-row").first()).toContainText(
      name,
      { timeout: 20_000 },
    );

    // And Danh mục lists it in the Chẩn đoán catalog, in the group the dialog chose.
    const listed = await call<{ items: CatalogEntry[] }>(
      page,
      `${ENTRIES}?group=diagnosis&clinicBranchId=${BRANCH_ONE}&filter=${encodeURIComponent(name)}`,
      { branchId: BRANCH_ONE },
    );
    expect(listed.body.items.map((item) => [item.id, item.taxonomyId])).toEqual([
      [entry.id, entry.taxonomyId],
    ]);

    // Deleted in Danh mục (soft), it is no longer offered for a new slip...
    const full = await call<Record<string, unknown>>(
      page,
      `${ENTRIES}?group=diagnosis&clinicBranchId=${BRANCH_ONE}&filter=${encodeURIComponent(name)}`,
      { branchId: BRANCH_ONE },
    );
    const removed = await call(page, `${ENTRIES}/${entry.id}`, {
      method: "PUT",
      branchId: BRANCH_ONE,
      json: { ...(full.body.items as Record<string, unknown>[])[0], isDeleted: true },
    });
    expect(removed.status, JSON.stringify(removed.body)).toBe(200);

    const fresh = await openDiagnosisForm(page, patientId);
    await fresh.locator(".pd-diagnosis-pick .ant-select").click();
    await page.keyboard.type(name);
    const dropdown = page.locator(".ant-select-dropdown:not(.ant-select-dropdown-hidden)").last();
    await expect(dropdown).toContainText("Không tìm thấy kết quả");
    await expect(dropdown.locator(".ant-select-item-option")).toHaveCount(0);
    await page.keyboard.press("Escape");
    await fresh.getByRole("button", { name: "Đóng" }).click();
    await expect(fresh).toBeHidden();

    // ...while the slip already made with it keeps its name, in the table and
    // opened again.
    const savedRow = page.locator(".pd-diagnosis-card tbody tr.ant-table-row").first();
    await expect(savedRow).toContainText(name);
    await savedRow.click();
    const saved = page.getByTestId("diagnosis-form");
    await expect(saved.locator(".pd-diagnosis-pick .ant-select-content-has-value")).toHaveText(name);
  });

  test("without the right to add to Chẩn đoán there is no +, and the server refuses too", async ({
    page,
    browser,
  }) => {
    const id = runId();
    const roleName = `Chỉ phiếu CĐ ${id}`;
    const role = await call<{ id: string }>(page, "/api/identity/roles", {
      method: "POST",
      json: { name: roleName, isDefault: false, isPublic: true },
    });
    expect(role.status).toBe(200);
    const grants = await call(
      page,
      `/api/permission-management/permissions?providerName=R&providerKey=${encodeURIComponent(roleName)}`,
      { method: "PUT", json: { permissions: SLIP_ONLY.map((n) => ({ name: n, isGranted: true })) } },
    );
    expect(grants.status).toBe(204);

    const userName = `nhanhcd${id}`;
    const staff = await call<{ id: string }>(page, "/api/v1/app/staff", {
      method: "POST",
      json: {
        userName,
        password: PASSWORD,
        name: `Nhân viên chỉ phiếu ${id}`,
        email: `${userName}@bluedental.local`,
        roleNames: [roleName],
        branchIds: [BRANCH_ONE],
        isActive: true,
      },
    });
    expect(staff.status, JSON.stringify(staff.body)).toBe(200);
    const patientId = await createPatient(page, id);
    const groups = await call<{ items: { id: string }[] }>(
      page,
      `/api/v1/app/taxonomies?group=diagnosis&clinicBranchId=${BRANCH_ONE}`,
      { branchId: BRANCH_ONE },
    );

    const limited = await openSession(browser, userName);
    try {
      const form = await openDiagnosisForm(limited.page, patientId);
      // The picker is there to choose from; the + that adds to it is not.
      await expect(form.locator(".pd-diagnosis-pick .ant-select")).toBeVisible();
      await expect(form.getByRole("button", { name: QUICK })).toHaveCount(0);

      const refused = await call(limited.page, ENTRIES, {
        method: "POST",
        branchId: BRANCH_ONE,
        json: {
          clinicBranchId: BRANCH_ONE,
          taxonomyId: groups.body.items[0].id,
          name: `Không được thêm ${id}`,
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
