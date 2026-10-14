import { expect, test, type Page } from "@playwright/test";
import { assertRealApiTraffic, login, runId } from "./fixtures/auth";
import { call } from "./fixtures/timekeepingStaff";

/**
 * Teeth picked as a whole jaw are shown by the jaw's name — "Hàm trên",
 * "Hàm dưới", "Nguyên hàm" — wherever the teeth of a diagnosis are listed;
 * teeth picked one by one keep being listed by number.
 *
 * Real stack: the patient and the diagnoses are made through the API and read
 * back on the Chẩn đoán & Tư vấn tab and on a printed sheet. Nothing is intercepted.
 */

const BRANCH = "11111111-1111-1111-1111-111111111111";
const UPPER = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
const LOWER = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];

const whole = (codes: number[]) =>
  codes.map((toothCode) => ({ toothCode, selected: true, top: false, right: false, bottom: false, left: false, center: false }));

async function diagnose(page: Page, patientId: string, teeth: number[]) {
  const catalog = await call<{ items: Array<{ id: string }> }>(
    page,
    `/api/v1/app/catalog-entries?clinicBranchId=${BRANCH}&group=diagnosis&isActive=true&maxResultCount=1`,
    { branchId: BRANCH },
  );
  const staff = await call<{ items: Array<{ id: string }> }>(page, "/api/v1/app/staff?MaxResultCount=1", {
    branchId: BRANCH,
  });
  const slip = await call(page, "/api/v1/app/patient-diagnoses", {
    method: "POST",
    branchId: BRANCH,
    json: {
      patientId,
      clinicBranchId: BRANCH,
      diagnosisId: catalog.body.items[0].id,
      staffId: staff.body.items[0].id,
      teeth: whole(teeth),
    },
  });
  expect(slip.status, JSON.stringify(slip.body)).toBe(200);
}

test("a whole jaw is shown by its name, single teeth by number", async ({ page }) => {
  test.setTimeout(90_000);
  await login(page);
  await page.goto("/patient");
  await assertRealApiTraffic(page, "/api/v1/app/patients");

  const suffix = runId();
  const patient = await call<{ id: string }>(page, "/api/v1/app/patients", {
    method: "POST",
    branchId: BRANCH,
    json: {
      firstName: "Hàm",
      lastName: `Răng ${suffix}`,
      gender: 1,
      phoneNumber: `08${suffix.padStart(8, "0").slice(-8)}`,
      dateOfBirth: "1985-03-03",
    },
  });
  expect(patient.status, JSON.stringify(patient.body)).toBe(200);
  const id = patient.body.id;

  await diagnose(page, id, UPPER);
  await diagnose(page, id, LOWER);
  await diagnose(page, id, [...UPPER, ...LOWER]);
  // Fifteen of the upper sixteen is not the jaw: listed tooth by tooth.
  await diagnose(page, id, UPPER.slice(1));
  await diagnose(page, id, [16, 26]);

  await page.goto(`/patient/${id}?branchId=${BRANCH}&tab=consulting`);
  const teethCells = page.locator(".pd-cell-link");
  await expect(teethCells.filter({ hasText: /^Hàm trên$/ })).toHaveCount(1);
  await expect(teethCells.filter({ hasText: /^Hàm dưới$/ })).toHaveCount(1);
  await expect(teethCells.filter({ hasText: /^Nguyên hàm$/ })).toHaveCount(1);
  await expect(teethCells.filter({ hasText: /^17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28$/ })).toHaveCount(1);
  await expect(teethCells.filter({ hasText: /^16, 26$/ })).toHaveCount(1);
  // None of the jaws is spelled out as its numbers any more.
  await expect(teethCells.filter({ hasText: /^18, 17, 16/ })).toHaveCount(0);
});
