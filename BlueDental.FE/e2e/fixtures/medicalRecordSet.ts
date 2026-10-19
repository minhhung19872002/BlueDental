import { expect, type Page } from "@playwright/test";
import { assertRealApiTraffic, runId } from "./auth";
import { call, firstBranchId } from "./timekeepingStaff";

/**
 * Bộ hồ sơ bệnh án — what the Bệnh án specs need around it, through the real
 * API: a patient whose record has a live set open, or a patient of their own
 * with treatment slips to make sets from.
 */

export const SETS_API = "/api/v1/app/medical-record-sets";
export const SHEETS_API = "/api/v1/app/patient-medical-records";

export interface RecordSet {
  id: string;
  code: string;
  status: number;
  visibleForms: number[];
  plans: { treatmentPlanId: string; planCode: string; diagnosisSlipCode: string | null }[];
}

export interface RecordSetPlan {
  treatmentPlanId: string;
  planCode: string;
  planStatus: number;
  notStarted: boolean;
  recordSetId: string | null;
}

/**
 * The patient the Bệnh án specs write on: one who already keeps sheets, so a
 * set is already there; on an empty database, the owner of the first live
 * treatment slip, with a set opened for it.
 */
async function recordPatient(page: Page): Promise<string> {
  // The record opens only for a patient of the branch being worked in, and one
  // not deleted since.
  const branch = await firstBranchId(page);
  const opens = async (patientId: string) =>
    (await call(page, `/api/v1/app/patients/${patientId}`, { branchId: branch })).status === 200;

  // One keeping a few sheets — the print picker test needs more than two — but
  // the fewest such: a stack of dozens, left by earlier runs, turns ticking
  // through that picker into a crawl.
  const sheets = await call<{ items: { patientId: string; clinicBranchId: string }[] }>(
    page,
    `${SHEETS_API}?maxResultCount=1000`,
  );
  const counts = new Map<string, number>();
  for (const sheet of sheets.body.items.filter((item) => item.clinicBranchId === branch)) {
    counts.set(sheet.patientId, (counts.get(sheet.patientId) ?? 0) + 1);
  }
  const keepers = [...counts]
    .sort((a, b) => Number(a[1] < 3) - Number(b[1] < 3) || a[1] - b[1])
    .map(([patientId]) => patientId);
  for (const keeper of keepers) {
    if ((await opens(keeper)) && (await liveSet(page, keeper))) return keeper;
  }

  const slips = await call<{
    items: { id: string; patientId: string; branchId: string; status: number }[];
  }>(page, "/api/v1/app/patient-treatments?maxResultCount=50");
  const slip = slips.body.items.find((item) => item.status !== 6 && item.branchId === branch);
  expect(slip, "the demo clinic should have a live treatment slip").toBeTruthy();
  if (!(await liveSet(page, slip!.patientId))) {
    const made = await call(page, SETS_API, {
      method: "POST",
      json: { patientId: slip!.patientId, treatmentPlanIds: [slip!.id], visibleForms: [] },
    });
    expect(made.status, JSON.stringify(made.body)).toBe(200);
  }
  return slip!.patientId;
}

async function liveSet(page: Page, patientId: string): Promise<RecordSet | undefined> {
  return (await setsOf(page, patientId)).find((set) => set.status === 1);
}

export async function setsOf(page: Page, patientId: string): Promise<RecordSet[]> {
  const sets = await call<{ items: RecordSet[] }>(page, `${SETS_API}?patientId=${patientId}`);
  expect(sets.status).toBe(200);
  return sets.body.items;
}

export async function slipsOf(page: Page, patientId: string): Promise<RecordSetPlan[]> {
  const plans = await call<{ items: RecordSetPlan[] }>(
    page,
    `${SETS_API}/plans?patientId=${patientId}`,
  );
  expect(plans.status).toBe(200);
  return plans.body.items;
}

/** Opens a patient's record on Bệnh án, once its sets have been read. */
export async function openBenhAn(page: Page, patientId: string): Promise<void> {
  await page.goto(`/patient/${patientId}`);
  // Both lists go out when the view mounts; counting cards before the sheets
  // land reads zero on a patient who already has some.
  const listed = Promise.all(
    [`${SETS_API}?patientId=`, `${SHEETS_API}?patientId=`].map((url) =>
      page.waitForResponse((res) => res.url().includes(url) && res.request().method() === "GET"),
    ),
  );
  // The record settles its `?branch=` first; a click before that is lost.
  await expect(async () => {
    await page.getByRole("button", { name: /(^|\s)Bệnh án$/ }).click();
    await expect(page).toHaveURL(/view=medical-record/, { timeout: 2_000 });
  }).toPass();
  for (const response of await listed) expect(response.ok()).toBeTruthy();
}

/**
 * The Bệnh án specs' way in: the record patient's Bệnh án, open on the set its
 * sheets are kept in. Returns the patient's id.
 */
export async function openRecordWithSet(page: Page): Promise<string> {
  await page.goto("/patient");
  await assertRealApiTraffic(page, "/api/v1/app/patients");
  const patientId = await recordPatient(page);
  await openBenhAn(page, patientId);
  await expect(page.locator(".pd-medical-forms")).toBeAttached();
  return patientId;
}

/** "Hủy phiếu" through the API — the specs' tidy-up, now that a sheet is never deleted. */
export async function cancelSheet(
  page: Page,
  sheetId: string,
  reason = "E2E dọn dẹp",
): Promise<number> {
  return (await call(page, `${SHEETS_API}/${sheetId}/cancel`, { method: "POST", json: { reason } }))
    .status;
}

export interface SeededPatient {
  id: string;
  code: string;
  /** The diagnosis slip both treatment slips were consulted from. */
  diagnosisSlipCode: string;
  diagnosisName: string;
  /** One-line treatment slips, oldest first. */
  slips: { id: string; code: string; lineId: string }[];
  branchId: string;
}

/**
 * A patient of the run's own: one diagnosis slip, and `count` treatment slips each
 * opened from a consulting line on it — the chain the clinic runs (diagnose →
 * advise → accept → open slip). No set yet. With `warranty`, the services are
 * ones Danh mục gives a warranty period, so a warranty công đoạn may be raised.
 */
export async function seedPatientWithSlips(
  page: Page,
  count = 3,
  { warranty = false }: { warranty?: boolean } = {},
): Promise<SeededPatient> {
  const suffix = runId();
  await page.goto("/patient");
  await assertRealApiTraffic(page, "/api/v1/app/patients");

  const branch = await firstBranchId(page);
  const asBranch = { branchId: branch };

  const patient = await call<{ id: string; patientCode: string }>(page, "/api/v1/app/patients", {
    method: "POST",
    json: {
      firstName: `Bộ hồ sơ ${suffix}`,
      lastName: "E2E",
      dateOfBirth: null,
      gender: "male",
      phoneNumber: `06${suffix.padStart(8, "0").slice(-8)}`,
    },
    ...asBranch,
  });
  expect(patient.status, JSON.stringify(patient.body)).toBe(200);

  const diagnosis = (
    await call<{ items: { id: string; name: string }[] }>(
      page,
      `/api/v1/app/catalog-entries?clinicBranchId=${branch}&group=diagnosis&isActive=true&maxResultCount=1`,
      asBranch,
    )
  ).body.items[0];
  // Plain services that stay put: not deleted, not a combo, and not one another
  // spec made for its own run (a six-digit run id in the name) and deletes mid-run.
  const services = (
    await call<{
      items: {
        id: string;
        name: string;
        isDeleted: boolean;
        isCombo: boolean;
        price: number | null;
        serviceConfig?: { priceAfterDiscount: number; warrantyDays: number } | null;
      }[];
    }>(
      page,
      `/api/v1/app/catalog-entries?clinicBranchId=${branch}&group=care_service&isActive=true&maxResultCount=1000`,
      asBranch,
    )
  ).body.items
    .filter((entry) => !entry.isDeleted && !entry.isCombo && !/\d{6}/.test(entry.name))
    .filter((entry) => !warranty || (entry.serviceConfig?.warrantyDays ?? 0) > 0);
  const priceOf = (entry: (typeof services)[number]) =>
    entry.serviceConfig?.priceAfterDiscount ?? entry.price ?? 0;
  const staff = (
    await call<{ items: { id: string }[] }>(page, "/api/v1/app/staff?MaxResultCount=1", asBranch)
  ).body.items[0];
  expect(diagnosis, "a diagnosis in Danh mục").toBeTruthy();
  expect(services.length, `${count} services in Danh mục`).toBeGreaterThanOrEqual(count);
  expect(staff, "a dentist").toBeTruthy();

  const tooth = (toothCode: number) => ({
    toothCode,
    selected: true,
    top: false,
    right: false,
    bottom: false,
    left: false,
    center: false,
  });
  const slip = await call<{ id: string; code: string }>(page, "/api/v1/app/patient-diagnoses", {
    method: "POST",
    json: {
      patientId: patient.body.id,
      clinicBranchId: branch,
      diagnosisId: diagnosis.id,
      staffId: staff.id,
      note: `e2e bộ hồ sơ ${suffix}`,
      teeth: [tooth(12), tooth(11)],
    },
    ...asBranch,
  });
  expect(slip.status, JSON.stringify(slip.body)).toBe(200);

  const slips: SeededPatient["slips"] = [];
  for (const [index, service] of services.slice(0, count).entries()) {
    const advise = await call<{ id: string }>(page, "/api/v1/app/patient-advises", {
      method: "POST",
      json: {
        patientId: patient.body.id,
        clinicBranchId: branch,
        patientDiagnosisId: slip.body.id,
        diagnosisId: diagnosis.id,
        serviceId: service.id,
        staffId: staff.id,
        originalPrice: priceOf(service),
        price: priceOf(service),
        quantity: 1,
        discountType: 0,
        discountValue: 0,
        teeth: [tooth([12, 11, 21, 22, 13][index])],
      },
      ...asBranch,
    });
    expect(advise.status, JSON.stringify(advise.body)).toBe(200);
    expect(
      (
        await call(page, `/api/v1/app/patient-advises/${advise.body.id}/accept`, {
          method: "POST",
          ...asBranch,
        })
      ).status,
    ).toBe(200);

    const plan = await call<{ id: string; code: string; services: { id: string }[] }>(
      page,
      "/api/v1/app/patient-treatments",
      {
        method: "POST",
        json: {
          patientId: patient.body.id,
          clinicBranchId: branch,
          dentistId: staff.id,
          discountType: 0,
          discountValue: 0,
          voucherIds: [],
          adviseIds: [advise.body.id],
        },
        ...asBranch,
      },
    );
    expect(plan.status, JSON.stringify(plan.body)).toBe(200);
    slips.push({ id: plan.body.id, code: plan.body.code, lineId: plan.body.services[0].id });
  }

  return {
    id: patient.body.id,
    code: patient.body.patientCode,
    diagnosisSlipCode: slip.body.code,
    diagnosisName: diagnosis.name,
    slips,
    branchId: branch,
  };
}
