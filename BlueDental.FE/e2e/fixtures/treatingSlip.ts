import { expect, type Page } from "@playwright/test";
import { call } from "./timekeepingStaff";

/**
 * A slip whose "Bác sĩ tiếp nhận" is a given dentist, opened through the real
 * API (advise → accept → slip). Since R-961 a non-admin sees a slip on
 * "Kế hoạch điều trị", and opens its page, only when it belongs to a dentist
 * in their part of the Sơ đồ tổ chức — so a restricted account needs a slip of
 * its own.
 */

export const PLANS_API = "/api/v1/app/patient-treatments";

export interface TreatingSlip {
  id: string;
  code: string;
  patientId: string;
  dentistId: string;
  services: {
    id: string;
    price: number;
    quantity: number;
    discountType: number;
    discountValue: number;
    effectiveAmount: number;
  }[];
}

interface CatalogService {
  id: string;
  name: string;
  isDeleted: boolean;
  isCombo: boolean;
  price: number | null;
  serviceConfig?: { priceAfterDiscount: number; taxRate: number } | null;
}

/** A priced plain service of the branch, as `createSlipViaApi` picks one. */
async function pricedService(page: Page, branchId: string): Promise<{ id: string; price: number }> {
  const catalog = await call<{ items: CatalogService[] }>(
    page,
    `/api/v1/app/catalog-entries?clinicBranchId=${branchId}&group=care_service&isActive=true&maxResultCount=1000`,
    { branchId },
  );
  const price = (entry: CatalogService) => entry.serviceConfig?.priceAfterDiscount ?? entry.price ?? 0;
  const service = catalog.body.items.find(
    (entry) =>
      !entry.isDeleted &&
      !entry.isCombo &&
      (entry.serviceConfig?.taxRate ?? 0) <= 2 &&
      price(entry) >= 100_000 &&
      !/\d{6}/.test(entry.name),
  );
  if (!service) throw new Error("the branch has no priced service");
  return { id: service.id, price: price(service) };
}

/** The first patient of the branch, checked against their record. */
export async function firstPatientOf(page: Page, branchId: string): Promise<string> {
  // The list item carries no branch; the header narrows it, the record confirms it.
  const patients = await call<{ items: { id: string }[] }>(page, "/api/v1/app/patients?maxResultCount=1", { branchId });
  const patientId = patients.body.items[0].id;
  const patient = await call<{ branchId: string }>(page, `/api/v1/app/patients/${patientId}`);
  expect(patient.body.branchId).toBe(branchId);
  return patientId;
}

/** Opened by `admin`; one "Đã tạo" line on tooth 16. */
export async function openSlipFor(
  admin: Page,
  branchId: string,
  patientId: string,
  dentistId: string,
): Promise<TreatingSlip> {
  const service = await pricedService(admin, branchId);
  const advise = await call<{ id: string }>(admin, "/api/v1/app/patient-advises", {
    method: "POST",
    branchId,
    json: {
      patientId,
      clinicBranchId: branchId,
      patientDiagnosisId: null,
      diagnosisId: null,
      serviceId: service.id,
      staffId: dentistId,
      originalPrice: service.price,
      price: service.price,
      quantity: 1,
      discountType: 0,
      discountValue: 0,
      teeth: [{ toothCode: 16, selected: true, top: false, right: false, bottom: false, left: false, center: false }],
    },
  });
  expect(advise.status, JSON.stringify(advise.body.error)).toBe(200);
  const accepted = await call(admin, `/api/v1/app/patient-advises/${advise.body.id}/accept`, { method: "POST", branchId });
  expect(accepted.status).toBe(200);
  const plan = await call<TreatingSlip>(admin, PLANS_API, {
    method: "POST",
    branchId,
    json: { patientId, clinicBranchId: branchId, dentistId, discountType: 0, discountValue: 0, voucherIds: [], adviseIds: [advise.body.id] },
  });
  expect(plan.status, JSON.stringify(plan.body.error)).toBe(200);
  return plan.body;
}

/** "Xoá phiếu điều trị" through the API — a spec's cleanup. */
export async function deleteSlip(admin: Page, branchId: string, planId: string): Promise<void> {
  const res = await call(admin, `${PLANS_API}/${planId}`, { method: "DELETE", branchId });
  expect(res.status, "delete run slip").toBeLessThan(300);
}

/** The signed-in user's id, off the app's own configuration endpoint. */
export async function currentUserId(page: Page): Promise<string> {
  const config = await call<{ currentUser: { id: string } }>(page, "/api/abp/application-configuration");
  expect(config.status).toBe(200);
  return config.body.currentUser.id;
}
