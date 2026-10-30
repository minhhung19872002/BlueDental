import { expect, type Page } from "@playwright/test";
import { assertRealApiTraffic } from "./auth";
import { call, createOrder, laboCatalog, laboLine, orderBody } from "./laboApi";

/**
 * Seeding for the labo specs: a patient of the demo clinic and one Nháp
 * order on it, created through the same endpoints the dialog posts to, with
 * the cookie the browser holds after the real login. No API is intercepted.
 */

export interface LaboTarget {
  patientId: string;
  patientCode: string;
  patientName: string;
  branchId: string;
}

/** A service line of a treatment slip, with the patient the slip belongs to. */
export interface PlanLineTarget extends LaboTarget {
  planId: string;
  lineId: string;
}

export interface SeededLaboOrder {
  id: string;
  orderCode: string;
  supplierName: string;
  teeth: string;
  shade: string;
  instruction: string;
}

/** Any patient of the demo clinic, with the branch its record belongs to. */
export async function findLaboPatient(page: Page): Promise<LaboTarget> {
  await page.goto("/patient");
  await assertRealApiTraffic(page, "/api/v1/app/patients");
  const found = await page.evaluate(async () => {
    const list = (await (
      await fetch("/api/v1/app/patients?maxResultCount=1", { credentials: "include" })
    ).json()) as { items: { id: string }[] };
    const id = list.items[0]?.id;
    if (!id) return null;
    const patient = (await (
      await fetch(`/api/v1/app/patients/${id}`, { credentials: "include" })
    ).json()) as { id: string; patientCode: string; fullName: string; branchId: string };
    return {
      patientId: patient.id,
      patientCode: patient.patientCode,
      patientName: patient.fullName,
      branchId: patient.branchId,
    };
  });
  expect(found, "the demo clinic should have a patient").toBeTruthy();
  return found!;
}

/**
 * A fresh Created line of the Labo e2e service on a slip of the demo clinic —
 * `planId`, or the newest open slip of branch 1 — added through the slip's
 * own `POST services`. The spec drives it from there, so no seeded line is
 * used up.
 */
export async function addPlanLine(page: Page, planId?: string): Promise<PlanLineTarget> {
  const line = await laboLine(page, planId);
  const patient = await call<{ patientCode: string; fullName: string; branchId: string }>(
    page,
    `/api/v1/app/patients/${line.patientId}`,
  );
  expect(patient.status, patient.text).toBe(200);
  return {
    planId: line.planId,
    lineId: line.lineId,
    patientId: line.patientId,
    patientCode: patient.body.patientCode!,
    patientName: patient.body.fullName!,
    branchId: line.branchId,
  };
}

/**
 * One of the slip's line actions — `complete`, `cancel` or
 * `cancel-labo-orders` — posted the way the plan detail posts it.
 */
export async function driveLine(
  page: Page,
  line: PlanLineTarget,
  action: "complete" | "cancel" | "cancel-labo-orders",
): Promise<void> {
  const status = await page.evaluate(
    async ({ line, action }) => {
      const xsrf = document.cookie
        .split("; ")
        .find((c) => c.startsWith("XSRF-TOKEN="))
        ?.substring("XSRF-TOKEN=".length);
      const res = await fetch(
        `/api/v1/app/patient-treatments/${line.planId}/services/${line.lineId}/${action}`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "X-Clinic-Branch-Id": line.branchId,
            ...(xsrf ? { RequestVerificationToken: decodeURIComponent(xsrf) } : {}),
          },
        },
      );
      return { status: res.status, body: await res.text() };
    },
    { line, action },
  );
  expect(status.status, `POST …/${action}: ${status.body}`).toBe(200);
}

/**
 * One Nháp order with every field the Đặt hàng tab reads out, posted the way
 * the dialog's Lưu nháp posts it. The lab, material and dentist are the
 * branch's own, created only when the branch has none. With
 * `treatmentServiceId` the order hangs off that service line, as one raised
 * from the plan row does.
 */
export async function seedLaboOrder(
  page: Page,
  target: LaboTarget,
  id: string,
  treatmentServiceId?: string,
): Promise<SeededLaboOrder> {
  const catalog = await laboCatalog(page, target.branchId, id);
  const body = orderBody(catalog, target, id, { teeth: [11, 12], treatmentServiceId });
  const saved = await createOrder(page, body);
  expect(saved.status, saved.text).toBe(200);
  return {
    id: saved.body.id!,
    orderCode: saved.body.orderCode!,
    supplierName: catalog.supplierName,
    teeth: saved.body.toothNumbers ?? "11, 12",
    shade: body.toothShade,
    instruction: body.workDescription,
  };
}
