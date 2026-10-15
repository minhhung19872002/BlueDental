import { expect, test, type Page } from "@playwright/test";
import { assertRealApiTraffic, login, runId } from "./fixtures/auth";
import { BRANCH_IN_URL } from "./fixtures/branch";
import { call, openNewSlip } from "./fixtures/ledgerReceipt";
import {
  createDentist,
  deleteDentist,
  openDentistSession,
  resetDentistLeaves,
  setDentistLeaf,
} from "./fixtures/restrictedDentist";

/**
 * Feature: Chẩn đoán & Tư vấn follows the Phân quyền tree leaf by leaf.
 *
 * Before this the two services checked the legacy TreatmentRecords /
 * TreatmentPlans names, which the bridge grants on ANY treatment subject's
 * Sửa — and Xoá itself asked only for Sửa. A dentist with Xem / Thêm / Sửa
 * and no Xoá could delete a phiếu chẩn đoán (owner, 2026-10-14).
 *
 * Real stack only: the slip is written through the real API on admin's
 * session, the dentist is created through Nhân sự and signs in through the
 * login screen, leaves are toggled on Phân quyền. Nothing is intercepted.
 */

const BRANCH = "11111111-1111-1111-1111-111111111111";

interface Slip {
  patientId: string;
  diagnosisId: string;
  diagnosisCode: string;
  adviseId: string;
}

/** A diagnosis slip with one consulting line under it, on a branch-1 patient. */
async function seedSlip(page: Page, note: string): Promise<Slip> {
  await page.goto("/patient");
  await assertRealApiTraffic(page, "/api/v1/app/patients");
  const made = await page.evaluate(
    async ({ branch, text }) => {
      const headers = { "Content-Type": "application/json", "X-Clinic-Branch-Id": branch };
      const get = async (url: string) => (await fetch(url, { credentials: "include", headers })).json();
      const patient = (await get("/api/v1/app/patients?maxResultCount=1")).items[0];
      const diagnosis = (await get(`/api/v1/app/catalog-entries?clinicBranchId=${branch}&group=diagnosis&isActive=true&maxResultCount=1`)).items[0];
      const service = (await get(`/api/v1/app/catalog-entries?clinicBranchId=${branch}&group=care_service&isActive=true&maxResultCount=1`)).items[0];
      const staff = (await get("/api/v1/app/staff?MaxResultCount=1")).items[0];
      const tooth = { toothCode: 36, selected: true, top: false, right: false, bottom: false, left: false, center: false };
      const post = (url: string, body: unknown) =>
        fetch(url, { method: "POST", credentials: "include", headers, body: JSON.stringify(body) });

      const slipRes = await post("/api/v1/app/patient-diagnoses", {
        patientId: patient.id,
        clinicBranchId: branch,
        diagnosisId: diagnosis.id,
        staffId: staff.id,
        note: text,
        teeth: [tooth],
      });
      if (!slipRes.ok) return { error: `diagnosis ${slipRes.status} ${await slipRes.text()}` };
      const slip = await slipRes.json();

      const adviseRes = await post("/api/v1/app/patient-advises", {
        patientId: patient.id,
        clinicBranchId: branch,
        patientDiagnosisId: slip.id,
        diagnosisId: diagnosis.id,
        serviceId: service.id,
        staffId: staff.id,
        originalPrice: service.price ?? 0,
        price: service.price ?? 0,
        quantity: 1,
        discountType: 0,
        discountValue: 0,
        note: text,
        teeth: [tooth],
      });
      if (!adviseRes.ok) return { error: `advise ${adviseRes.status} ${await adviseRes.text()}` };
      const advise = await adviseRes.json();
      return {
        patientId: patient.id as string,
        diagnosisId: slip.id as string,
        diagnosisCode: slip.code as string,
        adviseId: advise.id as string,
      };
    },
    { branch: BRANCH, text: note },
  );
  expect("error" in made ? made.error : null, "the fixture should be written").toBeNull();
  return made as Slip;
}

/** DELETE on the dentist's own session, with the headers the app's client sends. */
async function deleteStatus(page: Page, url: string): Promise<number> {
  const xsrf = (await page.context().cookies()).find((c) => c.name === "XSRF-TOKEN")?.value ?? "";
  const res = await page.request.delete(url, {
    headers: {
      "X-Clinic-Branch-Id": BRANCH,
      RequestVerificationToken: decodeURIComponent(xsrf),
      Accept: "application/json, text/plain, */*",
    },
  });
  return res.status();
}

async function openConsulting(page: Page, slip: Slip) {
  await page.goto(`/patient/${slip.patientId}?branchId=${BRANCH}&tab=consulting`);
  await expect(diagnosisRow(page, slip)).toBeVisible({ timeout: 20_000 });
}

const diagnosisRow = (page: Page, slip: Slip) =>
  page.locator(".pd-diagnosis-card tbody tr.ant-table-row", { hasText: slip.diagnosisCode });

const READ_WRITE = [
  "patient.read",
  "treatmentDiagnosis.read",
  "treatmentDiagnosis.create",
  "treatmentDiagnosis.update",
  "treatmentConsultation.read",
  "treatmentConsultation.create",
  "treatmentConsultation.update",
] as const;
const DELETES = ["treatmentDiagnosis.delete", "treatmentConsultation.delete"] as const;
const LEAVES = [...READ_WRITE, ...DELETES];

test.describe("Chẩn đoán & Tư vấn — Xoá follows its own leaf", () => {
  test("Xem/Thêm/Sửa without Xoá: no bin and a 403; with Xoá: deletes", async ({ page, browser }) => {
    test.setTimeout(420_000);
    await page.setViewportSize({ width: 1600, height: 900 });

    const id = runId();
    const userName = `bs${id}`;
    const password = "Bacsi@123456";
    const fullName = `BAC SI ${id}`;

    await login(page);
    const slip = await seedSlip(page, `e2e quyền xoá ${id}`);
    await resetDentistLeaves(page, LEAVES);
    await createDentist(page, fullName, userName, password);
    for (const leaf of READ_WRITE) await setDentistLeaf(page, leaf, true);

    const { context, page: dentist } = await openDentistSession(browser, userName, password);
    try {
      await dentist.setViewportSize({ width: 1600, height: 900 });
      await dentist.goto("/patient");
      await expect(dentist).toHaveURL(BRANCH_IN_URL);

      // ── Xem / Thêm / Sửa, no Xoá ───────────────────────────────────────
      await openConsulting(dentist, slip);
      const row = diagnosisRow(dentist, slip);
      await expect(row.getByRole("button", { name: "Xoá chẩn đoán" })).toHaveCount(0);
      await expect(dentist.getByRole("button", { name: "Xoá dịch vụ tư vấn" })).toHaveCount(0);
      // The server refuses on its own, whatever the screen shows.
      expect(await deleteStatus(dentist, `/api/v1/app/patient-diagnoses/${slip.diagnosisId}`)).toBe(403);
      expect(await deleteStatus(dentist, `/api/v1/app/patient-advises/${slip.adviseId}`)).toBe(403);

      // ── Xoá granted: both bins, and the deletes go through ─────────────
      for (const leaf of DELETES) await setDentistLeaf(page, leaf, true);
      await openConsulting(dentist, slip);
      await expect(dentist.getByRole("button", { name: "Xoá dịch vụ tư vấn" }).first()).toBeVisible();
      await expect(diagnosisRow(dentist, slip).getByRole("button", { name: "Xoá chẩn đoán" })).toBeVisible();
      const adviseDelete = await deleteStatus(dentist, `/api/v1/app/patient-advises/${slip.adviseId}`);
      expect(adviseDelete).toBeLessThan(300);
      await dentist.reload();
      await expect(diagnosisRow(dentist, slip)).toBeVisible({ timeout: 20_000 });
      const deleted = dentist.waitForResponse(
        (res) =>
          res.url().endsWith(`/api/v1/app/patient-diagnoses/${slip.diagnosisId}`) &&
          res.request().method() === "DELETE",
      );
      await diagnosisRow(dentist, slip).getByRole("button", { name: "Xoá chẩn đoán" }).click();
      await dentist.getByRole("dialog").getByRole("button", { name: "Xoá" }).click();
      expect((await deleted).ok()).toBeTruthy();
      await dentist.reload();
      await expect(dentist.locator(".pd-diagnosis-card")).toBeVisible({ timeout: 20_000 });
      await expect(diagnosisRow(dentist, slip)).toHaveCount(0);
    } finally {
      await context.close();
      await resetDentistLeaves(page, LEAVES);
      await deleteDentist(page, fullName);
    }
  });

  test("Công đoạn without Xem: no way into Chi tiết phiếu; with Xem: the + is back", async ({
    page,
    browser,
  }) => {
    test.setTimeout(420_000);
    await page.setViewportSize({ width: 1600, height: 900 });

    const id = runId();
    const userName = `bs${id}`;
    const password = "Bacsi@123456";
    const fullName = `BAC SI ${id}`;
    // Everything of Công đoạn but Xem — the combination on the owner's screen.
    const base = ["patient.read", "treatmentConsultation.read", "treatmentStage.create", "treatmentStage.continue"];
    const leaves = [...base, "treatmentStage.read"];

    await login(page);
    await openNewSlip(page);
    const [, patientId, planId] =
      /\/patient\/([0-9a-f-]{36})\/treatment-plan\/([0-9a-f-]{36})/.exec(page.url()) ?? [];
    const code = String((await call(page, `/api/v1/app/patient-treatments/${planId}`)).body.code);
    await resetDentistLeaves(page, leaves);
    await createDentist(page, fullName, userName, password);
    for (const leaf of base) await setDentistLeaf(page, leaf, true);

    const { context, page: dentist } = await openDentistSession(browser, userName, password);
    try {
      await dentist.setViewportSize({ width: 1600, height: 900 });
      const planList = `/patient/${patientId}?branchId=${BRANCH}&tab=treatment-plan`;
      const slipDetail = `/patient/${patientId}/treatment-plan/${planId}?branchId=${BRANCH}&planTab=detail`;
      const addOnRow = dentist.getByRole("button", { name: `Thêm công đoạn ${code}` });
      // The slip page's toolbar has no "Thêm công đoạn" at all any more (owner
      // 2026-10-15): the row's + on Kế hoạch điều trị is the one door left.
      const addOnSlip = dentist.locator(".pdt-toolbar").getByRole("button", { name: "Thêm công đoạn" });

      // ── Thêm but no Xem: the door into the dialog is not offered ─────────
      await dentist.goto(planList);
      await expect(dentist.locator(".tp-table .tp-code", { hasText: code })).toBeVisible({ timeout: 20_000 });
      await expect(addOnRow).toHaveCount(0);
      await dentist.goto(slipDetail);
      await expect(dentist.getByRole("tab", { name: "Chi tiết" })).toBeVisible({ timeout: 20_000 });
      await expect(addOnSlip).toHaveCount(0);

      // ── Xem granted: the row's + comes back and opens Chi tiết phiếu ─────
      await setDentistLeaf(page, "treatmentStage.read", true);
      await dentist.goto(planList);
      await addOnRow.click();
      await expect(dentist.getByRole("dialog", { name: "Chi tiết phiếu" })).toBeVisible();
      await dentist.goto(slipDetail);
      await expect(dentist.getByRole("tab", { name: "Chi tiết" })).toBeVisible({ timeout: 20_000 });
      await expect(addOnSlip).toHaveCount(0);
    } finally {
      await context.close();
      await resetDentistLeaves(page, leaves);
      await deleteDentist(page, fullName);
    }
  });
});
