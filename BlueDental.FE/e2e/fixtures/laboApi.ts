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
  shade?: string | null;
  finishLineId?: string | null;
  labNote?: string | null;
  biteId?: string | null;
  shadeBySurface?: boolean;
  surfaces?: { code: string; shade?: string | null; finishLineId?: string | null }[];
  checkResult: number;
  defectNote: string | null;
  passedAt: string | null;
  /** Lần trả hàng that sent this tooth back as Lỗi (REQ-D5). */
  returnCount: number;
  warrantyCardCode: string | null;
  manufacturerSerial?: string | null;
  warrantyStartDate: string | null;
  warrantyConditions?: string | null;
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
  /** Thông số răng / Màu răng Chung or Riêng (R-1150). */
  specMode?: number;
  /** Khớp cắn is the order's since R-1150. */
  biteId?: string | null;
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
  /** toothNumber: null on Ảnh đính kèm chung, 0 on the "Dùng chung" row, else the tooth (P3110). */
  images: {
    id: string;
    url: string;
    roundNo: number | null;
    toothNumber?: number | null;
    /** Mặt trước 1 / Mặt sau 2 on an Ảnh thẻ bảo hành (P3110 REQ-E1), else null. */
    warrantyCardSide?: number | null;
  }[];
}

export interface Paged<T> {
  items: T[];
  totalCount: number;
}

export type FormValue = string | number | boolean | null | undefined | readonly (string | number)[];

export interface CallOptions {
  method?: "GET" | "PUT" | "POST" | "DELETE";
  branchId?: string;
  json?: unknown;
  /** Sent as multipart/form-data: an array repeats its key; null / undefined are left out. */
  form?: Record<string, FormValue>;
  /** How many 1×1 PNGs go under `pictures` with the form. */
  pictures?: number;
  /** One 1×1 PNG per entry under `toothPictures`, the entry its tooth (0 = "Dùng chung"). */
  toothPictures?: readonly number[];
  /** One 1×1 PNG per entry under `cardPhotos`, beside its `cardPhotoTeeth` and `cardPhotoSides`. */
  cardPhotos?: readonly CardPhoto[];
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
        (options.toothPictures ?? []).forEach((tooth, i) => {
          form.append("toothPictures", new Blob([bytes], { type: "image/png" }), `rang-${tooth}-${i + 1}.png`);
          form.append("toothPictureTeeth", String(tooth));
        });
        (options.cardPhotos ?? []).forEach(({ tooth, side }) => {
          form.append("cardPhotos", new Blob([bytes], { type: "image/png" }), `card-${tooth}-${side}.png`);
          form.append("cardPhotoTeeth", String(tooth));
          form.append("cardPhotoSides", String(side));
        });
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

/** What an order picks from the branch's catalogs: the ordering dentist, the lab, its material and a finish line. */
export interface LaboCatalog {
  dentistId: string;
  supplierId: string;
  supplierName: string;
  materialId: string;
  /** Đường hoàn tất: optional before Gửi Labo since R-1150 (was required, P3110 REQ-C1). */
  finishLineId: string;
  /** Khớp cắn, picked once per order since R-1150. */
  biteId: string;
  biteName: string;
}

/** The branch's first lab, labo_material group, material, finish line and dentist — each created only when missing. */
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
  const finishLine =
    (await first(`/api/v1/app/taxonomies?ClinicBranchId=${branchId}&Group=labo_finish_line&MaxResultCount=1`)) ??
    (await create("/api/v1/app/taxonomies", { group: "labo_finish_line", name: `Đường hoàn tất e2e ${id}`, clinicBranchId: branchId }));
  const bite =
    (await first(`/api/v1/app/taxonomies?ClinicBranchId=${branchId}&Group=labo_bite&MaxResultCount=1`)) ??
    (await create("/api/v1/app/taxonomies", { group: "labo_bite", name: `Khớp cắn e2e ${id}`, clinicBranchId: branchId }));
  const dentist = await first("/api/v1/app/staff?MaxResultCount=1&Role=1");
  expect(dentist, "the demo clinic should have a dentist").toBeTruthy();

  return {
    dentistId: dentist!.id,
    supplierId: supplier.id,
    supplierName: supplier.name,
    materialId: material.id,
    finishLineId: finishLine.id,
    biteId: bite.id,
    biteName: bite.name,
  };
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

/** A catalog service the specs put on their lines: its name and Danh mục's "Thời gian bảo hành (ngày)". */
export interface SpecService {
  name: string;
  warrantyDays: number;
}

/** The Labo specs' service: no picture needed to finish a công đoạn, no warranty days of its own. */
export const LABO_SERVICE: SpecService = { name: "DV LABO E2E", warrantyDays: 0 };
const serviceIds = new Map<string, string>();

/** `service`, reused across runs and created only when missing. */
async function specService(page: Page, service: SpecService): Promise<string> {
  const known = serviceIds.get(service.name);
  if (known) return known;
  const found = await call<Paged<{ id: string; name: string }>>(
    page,
    `/api/v1/app/catalog-entries?ClinicBranchId=${BRANCH_ONE}&Group=care_service&IsDeleted=false&IsActive=true&Filter=${encodeURIComponent(service.name)}&MaxResultCount=20`,
    { branchId: BRANCH_ONE },
  );
  expect(found.status, found.text).toBe(200);
  const existing = found.body.items?.find((item) => item.name === service.name);
  if (existing) {
    serviceIds.set(service.name, existing.id);
    return existing.id;
  }

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
      name: service.name,
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
        warrantyDays: service.warrantyDays,
        laboSupplierIds: [],
      },
    },
  });
  expect(made.status, made.text).toBe(200);
  serviceIds.set(service.name, made.body.id!);
  return made.body.id!;
}

interface SlipRow {
  id: string;
  patientId: string;
  branchId: string;
  status: number;
  creationTime: string;
  services: { id: string; serviceId: string; serviceName: string | null }[];
}

/** What a fresh line is made of; every field optional. */
export interface LineOptions {
  /** The slip to add to; by default the newest open branch-1 slip. */
  planId?: string;
  service?: SpecService;
  teeth?: readonly number[];
  /** TreatmentServiceStatus: 1 Đã tạo (default), 3 Hoàn thành. */
  status?: number;
}

/**
 * A fresh Created line of the Labo service on a branch-1 slip — the newest
 * open one, or `planId` — added through the slip's own `POST services`.
 * The spec drives it from there, so no seeded line is used up.
 */
export async function laboLine(page: Page, planId?: string): Promise<LaboLine> {
  return serviceLine(page, { planId });
}

/** A fresh line as {@link laboLine} adds it, of any spec service, teeth and status. */
export async function serviceLine(page: Page, options: LineOptions = {}): Promise<LaboLine> {
  const { planId, service = LABO_SERVICE, teeth = [], status = 1 } = options;
  await page.goto("/patient");
  await assertRealApiTraffic(page, "/api/v1/app/patients");
  const serviceId = await specService(page, service);

  const slip = planId ? await slipOf(page, planId) : await newestOpenSlip(page);

  const known = new Set(slip.services.map((line) => line.id));
  const added = await call<SlipRow>(page, `${PLANS}/${slip.id}/services`, {
    method: "POST",
    branchId: slip.branchId,
    json: {
      serviceId,
      price: 100000,
      quantity: 1,
      discountType: 0,
      discountValue: 0,
      status,
      teeth: teeth.map((toothCode) => ({ toothCode, selected: true })),
    },
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
    serviceName: line!.serviceName ?? service.name,
  };
}

async function slipOf(page: Page, planId: string): Promise<SlipRow> {
  const slip = await call<SlipRow>(page, `${PLANS}/${planId}`, { branchId: BRANCH_ONE });
  expect(slip.status, slip.text).toBe(200);
  return slip.body as SlipRow;
}

async function newestOpenSlip(page: Page): Promise<SlipRow> {
  const slips = await call<Paged<SlipRow>>(page, `${PLANS}?maxResultCount=300`, { branchId: BRANCH_ONE });
  expect(slips.status, slips.text).toBe(200);
  // 5 = Completed, 6 = Cancelled: a closed slip takes no new line.
  const slip = (slips.body.items ?? [])
    .filter((one) => one.branchId === BRANCH_ONE && one.status !== 5 && one.status !== 6)
    .sort((a, b) => b.creationTime.localeCompare(a.creationTime))[0];
  expect(slip, "branch 1 should have an open slip").toBeTruthy();
  return slip;
}

/**
 * A slip of its own for a spec whose counts must not ride on the shared one:
 * a new branch-1 patient, one accepted advise of the Labo service, and the
 * slip opened from it. Returns the slip's id, for {@link serviceLine}.
 */
export async function freshSlip(page: Page, tag: string): Promise<string> {
  await page.goto("/patient");
  await assertRealApiTraffic(page, "/api/v1/app/patients");
  const serviceId = await specService(page, LABO_SERVICE);
  const staff = await call<Paged<{ id: string }>>(page, "/api/v1/app/staff?MaxResultCount=1", { branchId: BRANCH_ONE });
  expect(staff.status, staff.text).toBe(200);
  const staffId = staff.body.items![0].id;

  const digits = `${Date.now()}${Math.floor(Math.random() * 1000)}`.slice(-8);
  const patient = await call<{ id: string }>(page, "/api/v1/app/patients", {
    method: "POST",
    branchId: BRANCH_ONE,
    json: { firstName: `Phiếu ${tag}`, lastName: "E2E", dateOfBirth: null, gender: "male", phoneNumber: `07${digits}` },
  });
  expect(patient.status, patient.text).toBe(200);

  const advise = await call<{ id: string }>(page, "/api/v1/app/patient-advises", {
    method: "POST",
    branchId: BRANCH_ONE,
    json: {
      patientId: patient.body.id,
      clinicBranchId: BRANCH_ONE,
      patientDiagnosisId: null,
      diagnosisId: null,
      serviceId,
      staffId,
      originalPrice: 100000,
      price: 100000,
      quantity: 1,
      discountType: 0,
      discountValue: 0,
      teeth: [{ toothCode: 18, selected: true, top: false, right: false, bottom: false, left: false, center: false }],
    },
  });
  expect(advise.status, advise.text).toBe(200);
  const accepted = await call(page, `/api/v1/app/patient-advises/${advise.body.id}/accept`, {
    method: "POST",
    branchId: BRANCH_ONE,
  });
  expect(accepted.status, accepted.text).toBe(200);

  const slip = await call<{ id: string }>(page, PLANS, {
    method: "POST",
    branchId: BRANCH_ONE,
    json: {
      patientId: patient.body.id,
      clinicBranchId: BRANCH_ONE,
      dentistId: staffId,
      discountType: 0,
      discountValue: 0,
      voucherIds: [],
      adviseIds: [advise.body.id],
    },
  });
  expect(slip.status, slip.text).toBe(200);
  return slip.body.id!;
}

/** The Đặt hàng tab's fields, every required one filled. */
export interface LaboOrderBody {
  patientId: string;
  branchId: string;
  dentistId: string;
  supplierId: string;
  materialId: string;
  teeth: number[];
  /** Order-level Màu răng / Đường hoàn tất: given to every tooth when no toothSpecs is sent. */
  toothShade: string;
  finishLineId: string;
  quantity: number;
  workDescription: string;
  notes: string;
  sentAt: string;
  dueAt: string;
  treatmentServiceId?: string;
  treatmentStageId?: string;
  /** Khớp cắn, one per order (R-1150). */
  biteId?: string;
  /** {@link SpecMode}; read only with toothSpecs. */
  specMode?: number;
  /**
   * Thông số từng răng. Left out, the fixture sends one row per tooth with the
   * order-level Màu / Đường hoàn tất and Mặt gần (M), every tooth's surface,
   * since Gửi Labo needs a Mặt răng on each tooth (R-1150).
   */
  toothSpecs?: LaboToothSpec[];
  submit: boolean;
}

/** LaboSpecMode on the wire (R-1150). */
export const SpecMode = { SharedAll: 1, SharedSpecOwnShade: 2, PerTooth: 3 } as const;

/** One Mặt răng of a tooth row: M · D · I · O · F · B · L. */
export interface LaboToothSurfaceSpec {
  code: string;
  shade?: string;
  finishLineId?: string;
}

/** One row of Thông số từng răng (P3110, surfaces since R-1150). */
export interface LaboToothSpec {
  toothNumber: number;
  shade?: string;
  finishLineId?: string;
  rhythmId?: string;
  shadeBySurface?: boolean;
  surfaces: LaboToothSurfaceSpec[];
}

/** The body as posted: toothSpecs filled in from the order-level values when the test gave none. */
export function orderPayload(body: LaboOrderBody): LaboOrderBody {
  if (body.toothSpecs || body.teeth.length === 0) return body;
  return {
    ...body,
    specMode: body.specMode ?? SpecMode.PerTooth,
    toothSpecs: body.teeth.map((toothNumber) => ({
      toothNumber,
      shade: body.toothShade,
      finishLineId: body.finishLineId,
      surfaces: [{ code: "M" }],
    })),
  };
}

/** The body as the dialog posts it in multipart: `toothSpecs[0].surfaces[1].code` keys. */
export function orderForm(body: LaboOrderBody): Record<string, FormValue> {
  const { toothSpecs, ...fields } = orderPayload(body);
  const form: Record<string, FormValue> = { ...fields };
  (toothSpecs ?? []).forEach(({ surfaces, ...spec }, i) => {
    for (const [key, value] of Object.entries(spec)) form[`toothSpecs[${i}].${key}`] = value;
    surfaces.forEach((surface, j) => {
      for (const [key, value] of Object.entries(surface)) form[`toothSpecs[${i}].surfaces[${j}].${key}`] = value;
    });
  });
  return form;
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
    finishLineId: catalog.finishLineId,
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
    ? call<LaboOrderView>(page, LABO_ORDERS, { method: "POST", branchId: body.branchId, json: orderPayload(body) })
    : call<LaboOrderView>(page, LABO_ORDERS, { method: "POST", branchId: body.branchId, form: orderForm(body), pictures });
}

/** A Đã gửi Labo order — submitted with one picture (optional since P3110) — answered 200. */
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

/**
 * Kiểm tra từng răng + Kết luận, posted as the dialog posts it: `teeth[i].*` form keys + Ảnh kiểm tra,
 * `toothPictures` being the Hình ảnh lỗi of each Lỗi tooth (REQ-D6).
 */
export async function check(
  page: Page,
  id: string,
  input: CheckInput,
  pictures = 0,
  toothPictures: readonly number[] = [],
): Promise<ApiResult<LaboOrderView>> {
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
  return call<LaboOrderView>(page, `${LABO_ORDERS}/${id}/check`, { method: "POST", form, pictures, toothPictures });
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

/** WarrantyCardSide on the wire. */
export const CardSide = { Front: 1, Back: 2 } as const;

/** One face of a tooth's warranty card, posted as a 1×1 PNG. */
export interface CardPhoto {
  tooth: number;
  side: number;
}

/** Kích hoạt bảo hành as the dialog posts it: multipart `cards[i].*` keys + the Ảnh thẻ bảo hành (REQ-E1). */
export async function activateWarrantyWithPhotos(
  page: Page,
  id: string,
  cards: WarrantyCard[],
  cardPhotos: readonly CardPhoto[],
): Promise<ApiResult<LaboOrderView>> {
  const form: Record<string, FormValue> = {};
  cards.forEach((card, i) => {
    for (const [key, value] of Object.entries(card)) form[`cards[${i}].${key}`] = value;
  });
  return call<LaboOrderView>(page, `${LABO_ORDERS}/${id}/warranty`, { method: "POST", form, cardPhotos });
}

/** Today in the clinic (UTC+7) as yyyy-MM-dd. */
export function clinicToday(): string {
  return new Date(Date.now() + 7 * 60 * 60_000).toISOString().slice(0, 10);
}
