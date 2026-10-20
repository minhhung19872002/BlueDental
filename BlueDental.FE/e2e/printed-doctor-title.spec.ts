import { expect, test, type Page } from "@playwright/test";
import { login, runId } from "./fixtures/auth";
import { SETS_API, openBenhAn, seedPatientWithSlips } from "./fixtures/medicalRecordSet";
import { call, clinicToday, createRunStaff, deleteStaff, firstBranchId } from "./fixtures/timekeepingStaff";

/**
 * Feature: printed sheets name a doctor by the Chức danh on their staff record,
 * and by their name only when none is set (owner, 2026-10-19). Screens keep the
 * name.
 *
 * Real stack: a doctor of the run's own, with a Chức danh, diagnoses, advises
 * and treats a patient of the run's own through the real API; the sheets are
 * read off the real UI. Nothing is intercepted.
 */

const STAFF = "/api/v1/app/staff";

interface Named {
  staffName: string | null;
  staffJobTitle: string | null;
}

interface Slip {
  id: string;
  dentistName: string | null;
  dentistJobTitle: string | null;
  services: { id: string; serviceId: string; teeth: unknown[] }[];
}

async function setJobTitle(page: Page, staffId: string, jobTitle: string | null) {
  const read = (await call<Record<string, unknown>>(page, `${STAFF}/${staffId}`)).body;
  const res = await call(page, `${STAFF}/${staffId}`, {
    method: "PUT",
    json: { ...read, password: undefined, jobTitle },
  });
  expect(res.status, JSON.stringify(res.body)).toBe(200);
}

/** "In phiếu điều trị": the hidden sheet the printer gets, beside the on-screen read-out. */
async function openSlipPrint(page: Page, patientId: string, planId: string) {
  await page.goto(`/patient/${patientId}/treatment-plan/${planId}`);
  await page.getByRole("button", { name: "In phiếu điều trị" }).click();
  const dialog = page.getByRole("dialog", { name: "Chi tiết phiếu" });
  await expect(dialog).toBeVisible();
  return dialog;
}

test.describe("Printed sheets name the doctor by Chức danh", () => {
  test.describe.configure({ timeout: 180_000 });

  test("slips, công đoạn, consulting and the Bệnh án print the Chức danh, and the name once it is cleared", async ({
    page,
  }) => {
    await login(page);
    const run = runId();
    const branch = await firstBranchId(page);
    const title = `ThS.BS. Chức danh ${run}`;
    const name = `Bác sĩ in ${run}`;
    const doctor = await createRunStaff(page, branch, run, { name, isDentist: true, jobTitle: `  ${title}  ` });

    try {
      const patient = await seedPatientWithSlips(page, 1, { staffId: doctor.id });
      const [first] = patient.slips;
      const asBranch = { branchId: patient.branchId };

      // Every record a printed sheet reads carries the Chức danh beside the name.
      const slip = (await call<Slip>(page, `/api/v1/app/patient-treatments/${first.id}`, asBranch)).body;
      expect(slip.dentistJobTitle).toBe(title);
      expect(slip.dentistName).not.toBe(title);
      const diagnoses = await call<{ items: Named[] }>(
        page,
        `/api/v1/app/patient-diagnoses?PatientId=${patient.id}`,
        asBranch,
      );
      expect(diagnoses.body.items.map((item) => item.staffJobTitle)).toEqual([title]);
      const advises = await call<{ items: Named[] }>(
        page,
        `/api/v1/app/patient-advises?PatientId=${patient.id}`,
        asBranch,
      );
      expect(advises.body.items.map((item) => item.staffJobTitle)).toEqual([title]);
      const line = slip.services[0];
      const stage = await call<Named & { id: string }>(page, "/api/v1/app/treatment-stages", {
        method: "POST",
        json: {
          patientId: patient.id,
          clinicBranchId: patient.branchId,
          treatmentId: slip.id,
          treatmentServiceId: line.id,
          serviceId: line.serviceId,
          name: "Công đoạn E2E",
          note: `Chức danh ${run}`,
          staffId: doctor.id,
          treatmentDate: clinicToday(),
          teeth: line.teeth,
          isGuarantee: false,
          warrantySourceStageId: null,
        },
        ...asBranch,
      });
      expect(stage.status, JSON.stringify(stage.body)).toBe(200);
      expect(stage.body.staffJobTitle).toBe(title);

      // Phiếu điều trị: the sheet prints the Chức danh in the Bác sĩ column and
      // under "Người lập phiếu"; the read-out on screen keeps the name.
      let dialog = await openSlipPrint(page, patient.id, first.id);
      const sheet = dialog.locator(".pdt-sheet");
      await expect(sheet.locator(".pdt-slip-sheet-table tbody td").nth(2)).toHaveText(title);
      await expect(sheet.locator(".pdt-slip-sheet-signs strong").first()).toHaveText(title);
      await expect(dialog.locator(".pdt-receipt-table tbody tr.ant-table-row")).toContainText(name);

      // Bệnh án: Phiếu Tư Vấn Tổng Quát's "1. Bác sĩ", after a reload.
      const made = await call(page, SETS_API, {
        method: "POST",
        json: { patientId: patient.id, treatmentPlanIds: [first.id], visibleForms: [] },
      });
      expect(made.status, JSON.stringify(made.body)).toBe(200);
      await openBenhAn(page, patient.id);
      await page.reload();
      await openBenhAn(page, patient.id);
      const form = page.locator(".pd-medical-form", { hasText: "Phiếu Tư Vấn Tổng Quát" });
      await form.getByRole("button", { name: "Thêm" }).click();
      await expect(page.getByText("Đã thêm phiếu bệnh án").first()).toBeVisible();
      await form.locator(".pd-sheet-card:not(.pd-sheet-card--cancelled) .pd-sheet-open").first().click();
      const blank = page
        .frameLocator(".mr-doc-frame")
        .locator('[data-medical-record-field="general-consultation.text.6"]');
      await expect(blank).toHaveText(title);

      // Phiếu tư vấn và xác nhận: the names under BÁC SĨ TƯ VẤN and BÁC SĨ ĐIỀU TRỊ.
      const consent = page.locator(".pd-medical-form", { hasText: "Phiếu tư vấn và xác nhận đồng ý điều trị" });
      await consent.getByRole("button", { name: "Thêm" }).click();
      await expect(page.getByText("Đã thêm phiếu bệnh án").first()).toBeVisible();
      await consent.locator(".pd-sheet-card:not(.pd-sheet-card--cancelled) .pd-sheet-open").first().click();
      const field = (id: string) =>
        page.frameLocator(".mr-doc-frame").locator(`[data-medical-record-field="${id}"]`);
      await expect(field("consultation.text.52")).toHaveText(title);
      await expect(field("consultation.text.57")).toHaveText(title);

      // No Chức danh: back to the name.
      await setJobTitle(page, doctor.id, null);
      dialog = await openSlipPrint(page, patient.id, first.id);
      await expect(dialog.locator(".pdt-sheet .pdt-slip-sheet-signs strong").first()).toHaveText(name);
    } finally {
      await deleteStaff(page, doctor.id);
    }
  });
});
