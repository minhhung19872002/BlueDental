import { expect, test, type Browser, type Locator, type Page } from "@playwright/test";
import { login, runId } from "./fixtures/auth";
import { collectOnFirstLine, createSlipViaApi, openNewSlip } from "./fixtures/ledgerReceipt";
import { call } from "./fixtures/timekeepingStaff";

/**
 * R-953 — "Xóa" on a line of the plan detail's "Chi tiết" tab (owner 2026-10-15).
 *
 * Only a line still "Đã tạo" carries the red bin; once it is under way or done
 * the bin is gone, and the server refuses it anyway (Treatment:0049). A line
 * with money against it keeps the bin but the server refuses (0050). Removing
 * a line hands its advise back to "Đã chấp nhận". The right is
 * treatmentConsultation.delete, not update.
 *
 * Real login screen, real API, real PostgreSQL; nothing is intercepted.
 */

const PLANS = "/api/v1/app/patient-treatments";
const ADVISES = "/api/v1/app/patient-advises";
const BRANCH_ONE = "11111111-1111-1111-1111-111111111111";
const NOT_CREATED = "BlueDental:Treatment:0049";
const HAS_PAYMENTS = "BlueDental:Treatment:0050";
const ADVISE_ACCEPTED = 2;
const LINE_CREATED = 1;
const LINE_DONE = 3;
const PASSWORD = "XoaDv@123456";

interface Slip {
  id: string;
  status: number;
  services: { id: string; status: number; sourceAdviseId: string | null }[];
}

interface ApiError {
  error?: { code?: string };
}

function serviceRows(page: Page): Locator {
  return page.locator(".pdt-table tr.ant-table-row");
}

function deleteButton(scope: Locator): Locator {
  return scope.getByRole("button", { name: "Xoá", exact: true });
}

async function branchOf(page: Page, patientId: string): Promise<string> {
  const patient = await call<{ branchId: string }>(page, `/api/v1/app/patients/${patientId}`);
  expect(patient.status).toBe(200);
  return patient.body.branchId;
}

async function readSlip(page: Page, planId: string, branchId: string): Promise<Slip> {
  const slip = await call<Slip>(page, `${PLANS}/${planId}`, { branchId });
  expect(slip.status).toBe(200);
  return slip.body;
}

test.describe("R-953 — Xóa dịch vụ trên phiếu điều trị", () => {
  test.setTimeout(180_000);

  test("a line still 'Đã tạo' is deleted, stays gone after reload, and its advise goes back to accepted", async ({ page }) => {
    await login(page);
    const { patientId, slip } = await openNewSlip(page);
    const branchId = await branchOf(page, patientId);
    const before = await readSlip(page, slip.id, branchId);
    const adviseId = before.services[0].sourceAdviseId;
    expect(adviseId).toBeTruthy();

    const row = serviceRows(page).filter({ hasText: slip.serviceName });
    await expect(row).toHaveCount(1);
    await deleteButton(row).click();

    const dialog = page.getByRole("dialog").filter({ hasText: "Xác nhận xoá dịch vụ" });
    await expect(dialog).toContainText(slip.serviceName);
    const removed = page.waitForResponse(
      (res) => res.url().includes(`${PLANS}/${slip.id}/services/`) && res.request().method() === "DELETE",
    );
    await dialog.getByRole("button", { name: /Xoá$/ }).click();
    expect((await removed).status()).toBe(200);
    await expect(page.getByText("Đã xóa dịch vụ")).toBeVisible();
    await expect(dialog).toBeHidden();
    await expect(serviceRows(page)).toHaveCount(0);

    await page.reload();
    await expect(page.locator(".pdt-table")).toBeVisible();
    await expect(serviceRows(page)).toHaveCount(0);

    const after = await readSlip(page, slip.id, branchId);
    expect(after.services).toHaveLength(0);
    const advise = await call<{ status: number }>(page, `${ADVISES}/${adviseId}`, { branchId });
    expect(advise.status).toBe(200);
    expect(advise.body.status).toBe(ADVISE_ACCEPTED);

    await call(page, `${PLANS}/${slip.id}`, { method: "DELETE", branchId });
  });

  test("a finished line shows no bin and the server refuses it with 0049; the line still 'Đã tạo' keeps it", async ({ page }) => {
    await login(page);
    const { patientId, slip } = await openNewSlip(page);
    const branchId = await branchOf(page, patientId);
    // A second line keeps the slip open once the first is done — a slip whose
    // every line is done closes, and then refuses for that reason (0002).
    const extra = await addSecondLine(page, slip.id, branchId, slip.serviceName);
    // The slip's own line — the one its advise brought — not the one just added.
    const lineId = (await readSlip(page, slip.id, branchId)).services.find((line) => line.sourceAdviseId)!.id;

    const done = await call<Slip>(page, `${PLANS}/${slip.id}/services/${lineId}/complete`, { method: "POST", branchId });
    expect(done.status, JSON.stringify(done.body)).toBe(200);
    expect(done.body.services.find((line) => line.id === lineId)?.status).toBe(LINE_DONE);

    await page.reload();
    const doneRow = serviceRows(page).filter({ hasText: slip.serviceName });
    await expect(doneRow.getByRole("button", { name: "Xem chi tiết" })).toBeVisible();
    await expect(deleteButton(doneRow)).toHaveCount(0);
    await expect(deleteButton(serviceRows(page).filter({ hasText: extra.name }))).toBeVisible();

    const refused = await call<ApiError>(page, `${PLANS}/${slip.id}/services/${lineId}`, { method: "DELETE", branchId });
    expect(refused.status).toBe(403);
    expect(refused.body.error?.code).toBe(NOT_CREATED);
    expect((await readSlip(page, slip.id, branchId)).services).toHaveLength(2);
  });

  test("a line with a receipt against it keeps the bin, but the delete is refused with 0050", async ({ page }) => {
    await login(page);
    const { patientId, slip } = await openNewSlip(page);
    const branchId = await branchOf(page, patientId);
    await page.getByRole("tab", { name: "Thanh toán", exact: true }).click();
    await collectOnFirstLine(page);
    await page.getByRole("tab", { name: "Chi tiết điều trị", exact: true }).click();

    const row = serviceRows(page).filter({ hasText: slip.serviceName });
    await deleteButton(row).click();
    const dialog = page.getByRole("dialog").filter({ hasText: "Xác nhận xoá dịch vụ" });
    await dialog.getByRole("button", { name: /Xoá$/ }).click();
    await expect(page.getByText("Dịch vụ đã có thanh toán, không thể xóa.")).toBeVisible();
    // The refusal leaves the dialog open, and the line where it was.
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Huỷ" }).click();

    await page.reload();
    await expect(serviceRows(page).filter({ hasText: slip.serviceName })).toHaveCount(1);
    const lineId = (await readSlip(page, slip.id, branchId)).services[0].id;
    const refused = await call<ApiError>(page, `${PLANS}/${slip.id}/services/${lineId}`, { method: "DELETE", branchId });
    expect(refused.status).toBe(403);
    expect(refused.body.error?.code).toBe(HAS_PAYMENTS);
  });

  test("without treatmentConsultation.delete there is no bin and the API answers 403", async ({ page, browser }) => {
    await login(page);
    const fixture = await setUpUpdateOnlyStaff(page);
    const patients = await call<{ items: { id: string }[] }>(page, "/api/v1/app/patients?maxResultCount=1", { branchId: BRANCH_ONE });
    const patientId = patients.body.items[0].id;
    const slip = await createSlipViaApi(page, patientId);
    const lineId = (await readSlip(page, slip.id, BRANCH_ONE)).services[0].id;

    const staff = await openSession(browser, fixture.userName);
    try {
      await staff.page.goto(`/patient/${patientId}/treatment-plan/${slip.id}`);
      const row = serviceRows(staff.page).filter({ hasText: slip.serviceName });
      await expect(row.getByRole("button", { name: "Xem chi tiết" })).toBeVisible();
      await expect(deleteButton(row)).toHaveCount(0);

      const refused = await call<ApiError>(staff.page, `${PLANS}/${slip.id}/services/${lineId}`, {
        method: "DELETE",
        branchId: BRANCH_ONE,
      });
      expect(refused.status).toBe(403);
      expect(refused.body.error?.code).not.toBe(NOT_CREATED);
      expect((await readSlip(page, slip.id, BRANCH_ONE)).services).toHaveLength(1);
    } finally {
      await staff.context.close();
      await call(page, `${PLANS}/${slip.id}`, { method: "DELETE", branchId: BRANCH_ONE });
      await call(page, `/api/v1/app/staff/${fixture.staffId}`, { method: "DELETE" });
      await call(page, `/api/identity/roles/${fixture.roleId}`, { method: "DELETE" });
    }
  });
});

interface CatalogService {
  id: string;
  name: string;
  isDeleted: boolean;
  isCombo: boolean;
  price: number | null;
}

/** A second line, "Đã tạo", on another priced service — straight through POST …/services. */
async function addSecondLine(page: Page, planId: string, branchId: string, except: string) {
  const catalog = await call<{ items: CatalogService[] }>(
    page,
    `/api/v1/app/catalog-entries?clinicBranchId=${branchId}&group=care_service&isActive=true&maxResultCount=1000`,
    { branchId },
  );
  const service = catalog.body.items.find(
    (entry) => !entry.isDeleted && !entry.isCombo && (entry.price ?? 0) > 0 && entry.name !== except && !/\d{6}/.test(entry.name),
  );
  if (!service) throw new Error("Danh mục dịch vụ không có mục thứ hai còn giá");
  const added = await call<Slip>(page, `${PLANS}/${planId}/services`, {
    method: "POST",
    branchId,
    json: {
      serviceId: service.id,
      price: service.price,
      quantity: 1,
      discountType: 0,
      discountValue: 0,
      teeth: [{ toothCode: 15, selected: true, top: false, right: false, bottom: false, left: false, center: false }],
      status: LINE_CREATED,
      diagnosisId: null,
      dentistId: null,
      note: null,
      diagnoserStaffId: null,
      secondDiagnoserStaffId: null,
      consultantStaffId: null,
      secondConsultantStaffId: null,
    },
  });
  expect(added.status, JSON.stringify(added.body)).toBe(200);
  return { name: service.name };
}

/** A role with the consulting chain's read and update, but not its delete. */
async function setUpUpdateOnlyStaff(page: Page) {
  const id = runId();
  const roleName = `Xoa dv ${id}`;
  const role = await call<{ id: string }>(page, "/api/identity/roles", {
    method: "POST",
    json: { name: roleName, isDefault: false, isPublic: true },
  });
  expect(role.status).toBe(200);
  const leaves = [
    "BlueDental.patient.read",
    "BlueDental.treatmentConsultation.read",
    "BlueDental.treatmentConsultation.update",
  ];
  const grant = await call(page, `/api/permission-management/permissions?providerName=R&providerKey=${encodeURIComponent(roleName)}`, {
    method: "PUT",
    json: { permissions: leaves.map((name) => ({ name, isGranted: true })) },
  });
  expect(grant.status).toBe(204);

  const userName = `xoadv${id}`;
  const staff = await call<{ id: string }>(page, "/api/v1/app/staff", {
    method: "POST",
    json: {
      userName,
      password: PASSWORD,
      name: `Nhân viên xoá dịch vụ ${id}`,
      email: `${userName}@bluedental.local`,
      roleNames: [roleName],
      branchIds: [BRANCH_ONE],
      isActive: true,
    },
  });
  expect(staff.status).toBe(200);
  return { roleId: role.body.id, staffId: staff.body.id, userName };
}

async function openSession(browser: Browser, userName: string) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await login(page, { userName, password: PASSWORD });
  return { context, page };
}
