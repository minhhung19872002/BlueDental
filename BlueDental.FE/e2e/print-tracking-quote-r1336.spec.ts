import { expect, test, type FrameLocator, type Page } from "@playwright/test";
import { login, runId } from "./fixtures/auth";
import { SETS_API, clickAddSheet, openBenhAn, seedPatientWithSlips } from "./fixtures/medicalRecordSet";
import { call } from "./fixtures/timekeepingStaff";

/**
 * Two printed sheets the owner marked up on paper (2026-11-28):
 *
 * R-1336, Phiếu theo dõi điều trị (mẫu 8): a four-word name stays on its line
 * — Tuổi moved right — instead of its last word flowing under it; Ngày, giờ is
 * narrower, the hour on the line under the day; Y lệnh/ Chi tiết điều trị is
 * the widest column.
 *
 * R-1337, Phiếu Báo Giá: no "THÔNG TIN CHI NHÁNH" over the clinic's lines; the
 * customer's Địa chỉ in full — street, ward, province.
 *
 * Real stack: patients of the run's own written through the real API into
 * PostgreSQL, the sheets read off the real UI. Nothing is intercepted.
 */

const PATIENTS = "/api/v1/app/patients";
/** Thành phố Hồ Chí Minh and one of its wards, as the address picker stores them. */
const PROVINCE = { code: "79", name: "Thành phố Hồ Chí Minh" };
const WARD = { code: "25747", name: "Phường Thủ Dầu Một" };
const STREET = "454 Võ Chí Công";

interface Patient {
  id: string;
  fullName: string;
  [key: string]: unknown;
}

function sheet(page: Page): FrameLocator {
  return page.frameLocator(".mr-doc-frame");
}

function blank(page: Page, field: string) {
  return sheet(page).locator(`[data-medical-record-field="${field}"]`);
}

/** Today on the clinic's calendar, as the sheet prints it. */
function clinicToday(): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date());
}

/** Renames a patient through the real update, every other field as it is. */
async function rename(page: Page, patientId: string, branchId: string, lastName: string, firstName: string) {
  const current = await call<Patient>(page, `${PATIENTS}/${patientId}`, { branchId });
  expect(current.status, JSON.stringify(current.body)).toBe(200);
  const { guardians: _guardians, ...rest } = current.body;
  const updated = await call<Patient>(page, `${PATIENTS}/${patientId}`, {
    method: "PUT",
    json: { ...rest, lastName, firstName },
    branchId,
  });
  expect(updated.status, JSON.stringify(updated.body)).toBe(200);
  return updated.body.fullName;
}

test.describe("Phiếu theo dõi điều trị — tên một dòng, cột Ngày giờ hẹp, Y lệnh rộng (R-1336)", () => {
  test.describe.configure({ timeout: 180_000 });

  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("a four-word name stays on its line beside Tuổi; the hour goes under the day; Y lệnh is the widest", async ({
    page,
  }) => {
    const patient = await seedPatientWithSlips(page, 1);
    const fullName = await rename(page, patient.id, patient.branchId, "Huỳnh Thị", "Thanh Phượng");
    expect(fullName.split(" ")).toHaveLength(4);

    // One công đoạn today, so row 1 has a Ngày, giờ to print.
    const slip = (
      await call<{ id: string; dentistId: string; services: { id: string; serviceId: string; teeth: unknown[] }[] }>(
        page,
        `/api/v1/app/patient-treatments/${patient.slips[0].id}`,
        { branchId: patient.branchId },
      )
    ).body;
    const line = slip.services[0];
    const stage = await call(page, "/api/v1/app/treatment-stages", {
      method: "POST",
      json: {
        patientId: patient.id,
        clinicBranchId: patient.branchId,
        treatmentId: slip.id,
        treatmentServiceId: line.id,
        serviceId: line.serviceId,
        name: "Công đoạn E2E",
        note: "Lấy dấu E2E",
        staffId: slip.dentistId,
        treatmentDate: new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date()),
        teeth: line.teeth,
        isGuarantee: false,
        warrantySourceStageId: null,
        warrantyKind: null,
      },
      branchId: patient.branchId,
    });
    expect(stage.status, JSON.stringify(stage.body)).toBe(200);

    const made = await call<{ id: string }>(page, SETS_API, {
      method: "POST",
      json: { patientId: patient.id, treatmentPlanIds: [patient.slips[0].id], visibleForms: [] },
    });
    expect(made.status, JSON.stringify(made.body)).toBe(200);

    await openBenhAn(page, patient.id);
    const form = "Phiếu theo dõi điều trị";
    await clickAddSheet(page, form);
    await expect(page.getByText("Đã thêm phiếu bệnh án").first()).toBeVisible();
    await page.locator(".pd-medical-form", { hasText: form }).locator(".pd-sheet-open").first().click();
    await expect(page.locator(".mr-doc-frame").first()).toBeVisible();

    // The name: whole in its own blank, nothing flowed under it, Tuổi on the same line.
    const name = blank(page, "treatment-tracking.page-1.patient.name");
    const age = blank(page, "treatment-tracking.page-1.patient.age");
    await expect(name).toHaveText(fullName.toLocaleUpperCase("vi"));
    await expect(
      sheet(page).locator('[data-flow-of="treatment-tracking.page-1.patient.name"]'),
    ).toHaveCount(0);
    const nameBox = (await name.boundingBox())!;
    const ageBox = (await age.boundingBox())!;
    expect(Math.abs(nameBox.y - ageBox.y), "Tuổi on the name's line").toBeLessThan(2);
    expect(ageBox.x, "Tuổi right of the name").toBeGreaterThan(nameBox.x + nameBox.width);
    // The whole "Họ và tên … Nam … Nữ" line still inside the page, on one line.
    const fits = await name.evaluate((field) => {
      const line = field.closest("p")!;
      const female = line.querySelector('[data-medical-record-field$="gender-female"]')!.getBoundingClientRect();
      const box = line.getBoundingClientRect();
      return { right: female.right, lineRight: box.right, height: box.height, lineHeight: parseFloat(getComputedStyle(line).lineHeight) };
    });
    expect(fits.right).toBeLessThanOrEqual(fits.lineRight);
    expect(fits.height).toBeLessThan(fits.lineHeight * 1.6);

    // Ngày, giờ: the day on the blank's line, the hour flowed under it in the same cell.
    const when = blank(page, "treatment-tracking.page-1.row-1.date-time");
    await expect(when).toHaveText(clinicToday());
    await expect(
      sheet(page).locator('[data-flow-of="treatment-tracking.page-1.row-1.date-time"]'),
    ).toHaveText(/^\d{2}:\d{2}$/);

    // The columns: Ngày, giờ the narrowest, Y lệnh/ Chi tiết điều trị the widest.
    const widths = await sheet(page)
      .locator("table:not([data-borderless]) tr")
      .first()
      .locator("th")
      .evaluateAll((cells) => cells.map((cell) => cell.getBoundingClientRect().width));
    expect(widths).toHaveLength(4);
    const total = widths.reduce((sum, width) => sum + width, 0);
    expect(widths[0] / total).toBeCloseTo(0.14, 1);
    expect(widths[2] / total).toBeCloseTo(0.38, 1);
    expect(widths[2]).toBe(Math.max(...widths));
    expect(widths[0]).toBe(Math.min(...widths));
  });
});

const BRANCH = "22222222-2222-2222-2222-222222222222";

/** A patient on the second branch with one priced advise line, for the báo giá. */
async function seedQuotePatient(page: Page, address: { street: string; provinceCode?: string; wardCode?: string }) {
  return page.evaluate(
    async ({ branch, suffix, address }) => {
      const headers = { "Content-Type": "application/json", "X-Clinic-Branch-Id": branch };
      const get = async (url: string) => (await fetch(url, { credentials: "include", headers })).json();
      const post = async (url: string, body: unknown) => {
        const res = await fetch(url, { method: "POST", credentials: "include", headers, body: JSON.stringify(body) });
        if (!res.ok) throw new Error(`${url} ${res.status} ${await res.text()}`);
        return res.json();
      };
      const patient = await post("/api/v1/app/patients", {
        firstName: `Báo giá ${suffix}`,
        lastName: "E2E",
        gender: "female",
        phoneNumber: `07${suffix.padStart(8, "0").slice(-8)}`,
        address: address.street,
        provinceCode: address.provinceCode ?? null,
        wardCode: address.wardCode ?? null,
      });
      const diagnosis = (await get(`/api/v1/app/catalog-entries?clinicBranchId=${branch}&group=diagnosis&isActive=true&maxResultCount=1`)).items[0];
      const service = (await get(`/api/v1/app/catalog-entries?clinicBranchId=${branch}&group=care_service&isActive=true&maxResultCount=1`)).items[0];
      const staff = (await get("/api/v1/app/staff?MaxResultCount=1")).items[0];
      const tooth = { toothCode: 21, selected: true, top: false, right: false, bottom: false, left: false, center: false };
      const slip = await post("/api/v1/app/patient-diagnoses", {
        patientId: patient.id,
        clinicBranchId: branch,
        diagnosisId: diagnosis.id,
        staffId: staff.id,
        note: `e2e báo giá ${suffix}`,
        teeth: [tooth],
      });
      await post("/api/v1/app/patient-advises", {
        patientId: patient.id,
        clinicBranchId: branch,
        patientDiagnosisId: slip.id,
        diagnosisId: diagnosis.id,
        serviceId: service.id,
        staffId: staff.id,
        originalPrice: 12_000_000,
        price: 12_000_000,
        quantity: 1,
        discountType: 0,
        discountValue: 0,
        teeth: [tooth],
      });
      return patient.id as string;
    },
    { branch: BRANCH, suffix: runId(), address },
  );
}

/** Ticks the patient's advise line, In Báo giá → In Hoá Đơn, and returns the printed sheet. */
async function openQuoteSheet(page: Page, patientId: string) {
  await page.goto(`/patient/${patientId}?tab=consulting&branchId=${BRANCH}`);
  const row = page.locator(".pd-advise-table tbody tr.ant-table-row").first();
  await expect(row).toBeVisible({ timeout: 20_000 });
  await row.locator(".ant-checkbox-input").check();
  await page.getByRole("button", { name: "In Báo giá", exact: true }).click();
  const detail = page.getByRole("dialog", { name: "Chi tiết phiếu" });
  await detail.getByRole("button", { name: "In Hoá Đơn" }).click();
  const sheet = page.locator(".pq-dialog--preview:visible .pq-sheet");
  await expect(sheet).toBeVisible();
  return sheet;
}

test.describe("Phiếu Báo Giá — không tiêu đề chi nhánh, địa chỉ khách hàng đầy đủ (R-1337)", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto("/patient");
  });

  test("the clinic's lines stand under no heading; Địa chỉ reads street, ward and province", async ({ page }) => {
    const patientId = await seedQuotePatient(page, { street: STREET, provinceCode: PROVINCE.code, wardCode: WARD.code });
    const sheet = await openQuoteSheet(page, patientId);

    await expect(sheet).not.toContainText("THÔNG TIN CHI NHÁNH");
    await expect(sheet.locator(".pq-sheet__branch p").first()).toHaveText(/^Phòng khám:/);
    await expect(sheet.locator(".pq-sheet__customer .pq-sheet__section-label")).toHaveText(/THÔNG TIN KHÁCH HÀNG/i);
    await expect(sheet.locator(".pq-sheet__customer p").filter({ hasText: /^Địa chỉ:/ })).toHaveText(
      `Địa chỉ: ${STREET}, ${WARD.name}, ${PROVINCE.name}`,
    );

    // Read again after a reload: what the sheet prints is what the hồ sơ holds.
    await page.reload();
    const again = await openQuoteSheet(page, patientId);
    await expect(again.locator(".pq-sheet__customer p").filter({ hasText: /^Địa chỉ:/ })).toHaveText(
      `Địa chỉ: ${STREET}, ${WARD.name}, ${PROVINCE.name}`,
    );
  });

  test("a hồ sơ with no ward or province prints the street alone", async ({ page }) => {
    const patientId = await seedQuotePatient(page, { street: STREET });
    const sheet = await openQuoteSheet(page, patientId);
    await expect(sheet.locator(".pq-sheet__customer p").filter({ hasText: /^Địa chỉ:/ })).toHaveText(`Địa chỉ: ${STREET}`);
  });
});
