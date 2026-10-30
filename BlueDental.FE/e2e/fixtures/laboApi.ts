import { expect, type Page } from "@playwright/test";
import { assertRealApiTraffic } from "./auth";

/**
 * The Labo endpoints as the specs drive them (P2910_03): real requests issued
 * from inside the logged-in page, with the cookie the real login left and the
 * antiforgery token the server set — the way the app's own axios client
 * calls. Nothing is intercepted and the database is the real one.
 */

export const LABO_ORDERS = "/api/v1/app/labo-orders";
export const PLANS = "/api/v1/app/patient-treatments";
export const STAGES = "/api/v1/app/treatment-stages";
export const BRANCH_ONE = "11111111-1111-1111-1111-111111111111";

/** A 1×1 PNG, the picture every multipart call attaches. */
const PNG_1PX_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

/** LaboStatus on the wire. */
export const LaboStatus = {
  Draft: 1,
  Sent: 2,
  AwaitingCheck: 3,
  Returned: 4,
  Completed: 5,
  Cancelled: 6,
  Warranty: 7,
} as const;

/** LaboToothCheckResult / LaboCheckConclusion on the wire. */
export const ToothResult = { None: 0, Passed: 1, Failed: 2 } as const;
export const Conclusion = { Pass: 1, ReturnAll: 2, ReturnDefective: 3 } as const;

export interface ApiError {
  error?: { code?: string; message?: string };
}

export interface ApiResult<T> {
  status: number;
  body: Partial<T> & ApiError;
  text: string;
}

export interface LaboToothView {
  toothNumber: number;
  checkResult: number;
  defectNote: string | null;
  passedAt: string | null;
  warrantyCardCode: string | null;
  warrantyStartDate: string | null;
  warrantyMonths: number | null;
  warrantyEndDate: string | null;
  isWarrantyExpired: boolean;
}

export interface LaboRoundView {
  roundNo: number;
  receivedQuantity: number;
  outcome: number;
  returnDescription: string | null;
  returnedAt: string | null;
  redeliveryDueAt: string | null;
  toothResults: { toothNumber: number; result: number; note: string | null }[];
}

export interface LaboOrderView {
  id: string;
  orderCode: string;
  status: number;
  patientId: string;
  branchId: string;
  labProviderName: string;
  supplierName: string | null;
  toothNumbers: string | null;
  toothShade: string | null;
  workDescription: string | null;
  quantity: number;
  sentAt: string | null;
  dueAt: string | null;
  receivedAt: string | null;
  returnCount: number;
  isWarrantyExpired: boolean;
  treatmentServiceId: string | null;
  treatmentStageId: string | null;
  teeth: LaboToothView[];
  rounds: LaboRoundView[];
  images: { id: string; url: string; roundNo: number | null }[];
}

export interface Paged<T> {
  items: T[];
  totalCount: number;
}

type FormValue = string | number | boolean | null | undefined | readonly (string | number)[];

export interface CallOptions {
  method?: "GET" | "PUT" | "POST" | "DELETE";
  branchId?: string;
  json?: unknown;
  /** Sent as multipart/form-data: an array repeats its key; null / undefined are left out. */
  form?: Record<string, FormValue>;
  /** How many 1×1 PNGs go under `pictures` with the form. */
  pictures?: number;
}

/** One request from the logged-in page: cookie session + antiforgery header + JSON Accept. */
export async function call<T = unknown>(page: Page, url: string, options: CallOptions = {}): Promise<ApiResult<T>> {
  return page.evaluate(
    async ({ url, options, png }) => {
      const xsrf = document.cookie
        .split("; ")
        .find((c) => c.startsWith("XSRF-TOKEN="))
        ?.substring("XSRF-TOKEN=".length);
      const headers: Record<string, string> = {
        accept: "application/json",
        ...(options.branchId ? { "X-Clinic-Branch-Id": options.branchId } : {}),
        ...(xsrf ? { RequestVerificationToken: decodeURIComponent(xsrf) } : {}),
      };
      let body: BodyInit | undefined;
      if (options.json !== undefined) {
        headers["content-type"] = "application/json";
        body = JSON.stringify(options.json);
      } else if (options.form) {
        const form = new FormData();
        for (const [key, value] of Object.entries(options.form)) {
          if (value === null || value === undefined) continue;
          for (const one of Array.isArray(value) ? value : [value]) form.append(key, String(one));
        }
        const bytes = Uint8Array.from(atob(png), (c) => c.charCodeAt(0));
        for (let i = 0; i < (options.pictures ?? 0); i++) {
          form.append("pictures", new Blob([bytes], { type: "image/png" }), `labo-${i + 1}.png`);
        }
        body = form;
      }
      const res = await fetch(url, { method: options.method ?? "GET", credentials: "include", headers, body });
      const text = await res.text();
      let parsed: unknown;
      try {
        parsed = text ? JSON.parse(text) : {};
      } catch {
        parsed = {};
      }
      return { status: res.status, body: parsed as Record<string, unknown>, text };
    },
    { url, options, png: PNG_1PX_BASE64 },
  ) as Promise<ApiResult<T>>;
}

/** What an order picks from the branch's catalogs: the ordering dentist, the lab and its material. */
export interface LaboCatalog {
  dentistId: string;
  supplierId: string;
  supplierName: string;
  materialId: string;
}

/** The branch's first lab, labo_material group, material and dentist — each created only when missing. */
export async function laboCatalog(page: Page, branchId: string, id: string): Promise<LaboCatalog> {
  const first = async (url: string) => {
    const res = await call<Paged<{ id: string; name: string }>>(page, url, { branchId });
    expect(res.status, `${url}: ${res.text}`).toBe(200);
    return res.body.items?.[0];
  };
  const create = async (url: string, json: unknown) => {
    const res = await call<{ id: string; name: string }>(page, url, { method: "POST", branchId, json });
    expect(res.status, `${url}: ${res.text}`).toBe(200);
    return { id: res.body.id!, name: res.body.name! };
  };

  const supplier =
    (await first(`/api/v1/app/labo-suppliers?ClinicBranchId=${branchId}&IsActive=true&MaxResultCount=1`)) ??
    (await create("/api/v1/app/labo-suppliers", {
      name: `Labo e2e ${id}`,
      email: `labo-${id}@example.com`,
      clinicBranchId: branchId,
    }));
  const group =
    (await first(`/api/v1/app/taxonomies?ClinicBranchId=${branchId}&Group=labo_material&MaxResultCount=1`)) ??
    (await create("/api/v1/app/taxonomies", { group: "labo_material", name: `Dịch vụ e2e ${id}`, clinicBranchId: branchId }));
  const material =
    (await first(`/api/v1/app/labo-materials?ClinicBranchId=${branchId}&TaxonomyId=${group.id}&MaxResultCount=1`)) ??
    (await create("/api/v1/app/labo-materials", { name: `Vật liệu e2e ${id}`, taxonomyId: group.id, clinicBranchId: branchId }));
  const dentist = await first("/api/v1/app/staff?MaxResultCount=1&Role=1");
  expect(dentist, "the demo clinic should have a dentist").toBeTruthy();

  return { dentistId: dentist!.id, supplierId: supplier.id, supplierName: supplier.name, materialId: material.id };
}

/** A service line of a slip, with what a công đoạn on it needs. */
export interface LaboLine {
  patientId: string;
  planId: string;
  lineId: string;
  branchId: string;
  serviceId: string;
  serviceName: string;
}

const LABO_SERVICE = "DV LABO E2E";
let laboServiceId: string | undefined;

/**
 * The catalog service the Labo specs put on their lines, reused across runs:
 * no picture needed to finish a công đoạn, no warranty days of its own.
 */
async function laboService(page: Page): Promise<string> {
  if (laboServiceId) return laboServiceId;
  const found = await call<Paged<{ id: string; name: string }>>(
    page,
    `/api/v1/app/catalog-entries?ClinicBranchId=${BRANCH_ONE}&Group=care_service&IsDeleted=false&IsActive=true&Filter=${encodeURIComponent(LABO_SERVICE)}&MaxResultCount=20`,
    { branchId: BRANCH_ONE },
  );
  expect(found.status, found.text).toBe(200);
  const existing = found.body.items?.find((item) => item.name === LABO_SERVICE);
  if (existing) return (laboServiceId = existing.id);

  const groups = await call<Paged<{ id: string }>>(
    page,
    `/api/v1/app/taxonomies?ClinicBranchId=${BRANCH_ONE}&Group=care_service&MaxResultCount=1`,
    { branchId: BRANCH_ONE },
  );
  const made = await call<{ id: string }>(page, "/api/v1/app/catalog-entries", {
    method: "POST",
    branchId: BRANCH_ONE,
    json: {
      clinicBranchId: BRANCH_ONE,
      taxonomyId: groups.body.items![0].id,
      name: LABO_SERVICE,
      price: 100000,
      stages: [],
      serviceConfig: {
        taxRate: 0,
        priceIncludesTax: false,
        discountIsPercent: true,
        discountValue: 0,
        requireImage: false,
        deductDoctorOnWarranty: false,
        separateRevenue: false,
        showToothOnInvoice: false,
        revenueByStage: false,
        requireStageSequence: false,
        warrantyDays: 0,
        laboSupplierIds: [],
      },
    },
  });
  expect(made.status, made.text).toBe(200);
  return (laboServiceId = made.body.id!);
}

interface SlipRow {
  id: string;
  patientId: string;
  branchId: string;
  status: number;
  creationTime: string;
  services: { id: string; serviceId: string; serviceName: string | null }[];
}

/**
 * A fresh Created line of the Labo service on a branch-1 slip — the newest
 * open one, or `planId` — added through the slip's own `POST services`.
 * The spec drives it from there, so no seeded line is used up.
 */
export async function laboLine(page: Page, planId?: string): Promise<LaboLine> {
  await page.goto("/patient");
  await assertRealApiTraffic(page, "/api/v1/app/patients");
  const serviceId = await laboService(page);

  const slips = await call<Paged<SlipRow>>(page, `${PLANS}?maxResultCount=300`, { branchId: BRANCH_ONE });
  expect(slips.status, slips.text).toBe(200);
  // 5 = Completed, 6 = Cancelled: a closed slip takes no new line.
  const slip = (slips.body.items ?? [])
    .filter((one) => (planId ? one.id === planId : one.branchId === BRANCH_ONE && one.status !== 5 && one.status !== 6))
    .sort((a, b) => b.creationTime.localeCompare(a.creationTime))[0];
  expect(slip, "branch 1 should have an open slip").toBeTruthy();

  const known = new Set(slip.services.map((line) => line.id));
  const added = await call<SlipRow>(page, `${PLANS}/${slip.id}/services`, {
    method: "POST",
    branchId: slip.branchId,
    json: { serviceId, price: 100000, quantity: 1, discountType: 0, discountValue: 0, status: 1 },
  });
  expect(added.status, added.text).toBe(200);
  const line = added.body.services?.find((one) => !known.has(one.id));
  expect(line, "POST services should answer with the new line").toBeTruthy();
  return {
    patientId: slip.patientId,
    planId: slip.id,
    lineId: line!.id,
    branchId: slip.branchId,
    serviceId,
    serviceName: line!.serviceName ?? LABO_SERVICE,
  };
}

/** The Đặt hàng tab's fields, every required one filled. */
export interface LaboOrderBody {
  patientId: string;
  branchId: string;
  dentistId: string;
  supplierId: string;
  materialId: string;
  teeth: number[];
  toothShade: string;
  quantity: number;
  workDescription: string;
  notes: string;
  sentAt: string;
  dueAt: string;
  treatmentServiceId?: string;
  treatmentStageId?: string;
  submit: boolean;
}

const DAY_MS = 24 * 60 * 60_000;

/** An ISO stamp `days` from now (negative = earlier). */
export function daysFromNow(days: number): string {
  return new Date(Date.now() + days * DAY_MS).toISOString();
}

export function orderBody(
  catalog: LaboCatalog,
  owner: { patientId: string; branchId: string },
  id: string,
  extra: Partial<LaboOrderBody> = {},
): LaboOrderBody {
  return {
    patientId: owner.patientId,
    branchId: owner.branchId,
    dentistId: catalog.dentistId,
    supplierId: catalog.supplierId,
    materialId: catalog.materialId,
    teeth: [11, 21],
    toothShade: `A2-${id}`,
    quantity: 2,
    workDescription: `Chỉ định e2e ${id}`,
    notes: `Ghi chú e2e ${id}`,
    sentAt: daysFromNow(-1),
    dueAt: daysFromNow(6),
    submit: false,
    ...extra,
  };
}

/** Lưu nháp / Tạo phiếu Labo: JSON without pictures, multipart with them. */
export async function createOrder(page: Page, body: LaboOrderBody, pictures = 0): Promise<ApiResult<LaboOrderView>> {
  return pictures === 0
    ? call<LaboOrderView>(page, LABO_ORDERS, { method: "POST", branchId: body.branchId, json: body })
    : call<LaboOrderView>(page, LABO_ORDERS, { method: "POST", branchId: body.branchId, form: { ...body }, pictures });
}

/** A Đã gửi Labo order — submitted with one picture — answered 200. */
export async function sentOrder(page: Page, body: LaboOrderBody): Promise<LaboOrderView> {
  const made = await createOrder(page, { ...body, submit: true }, 1);
  expect(made.status, made.text).toBe(200);
  expect(made.body.status).toBe(LaboStatus.Sent);
  return made.body as LaboOrderView;
}

export async function receive(
  page: Page,
  id: string,
  receivedQuantity: number,
  receivedAt = new Date().toISOString(),
): Promise<ApiResult<LaboOrderView>> {
  return call<LaboOrderView>(page, `${LABO_ORDERS}/${id}/receive`, {
    method: "POST",
    json: { receivedAt, receivedQuantity },
  });
}

export interface CheckInput {
  teeth: { toothNumber: number; result: number; note?: string }[];
  conclusion: number;
  description?: string;
  returnedAt?: string;
  redeliveryDueAt?: string;
}

/** Kiểm tra từng răng + Kết luận, posted as the dialog posts it: `teeth[i].*` form keys + Ảnh kiểm tra. */
export async function check(page: Page, id: string, input: CheckInput, pictures = 0): Promise<ApiResult<LaboOrderView>> {
  const form: Record<string, FormValue> = {
    conclusion: input.conclusion,
    description: input.description,
    returnedAt: input.returnedAt,
    redeliveryDueAt: input.redeliveryDueAt,
  };
  input.teeth.forEach((tooth, i) => {
    form[`teeth[${i}].toothNumber`] = tooth.toothNumber;
    form[`teeth[${i}].result`] = tooth.result;
    form[`teeth[${i}].note`] = tooth.note;
  });
  return call<LaboOrderView>(page, `${LABO_ORDERS}/${id}/check`, { method: "POST", form, pictures });
}

/** Every due tooth Đạt + Xác nhận Labo đạt. */
export async function passAll(page: Page, id: string, teeth: number[]): Promise<LaboOrderView> {
  const passed = await check(page, id, {
    teeth: teeth.map((toothNumber) => ({ toothNumber, result: ToothResult.Passed })),
    conclusion: Conclusion.Pass,
  });
  expect(passed.status, passed.text).toBe(200);
  expect(passed.body.status).toBe(LaboStatus.Completed);
  return passed.body as LaboOrderView;
}

export interface WarrantyCard {
  toothNumber: number;
  startDate: string;
  months: number;
  manufacturerSerial?: string;
  conditions?: string;
}

export async function activateWarranty(page: Page, id: string, cards: WarrantyCard[]): Promise<ApiResult<LaboOrderView>> {
  return call<LaboOrderView>(page, `${LABO_ORDERS}/${id}/warranty`, { method: "POST", json: { cards } });
}

/** Today in the clinic (UTC+7) as yyyy-MM-dd. */
export function clinicToday(): string {
  return new Date(Date.now() + 7 * 60 * 60_000).toISOString().slice(0, 10);
}
