import { expect, type Page } from "@playwright/test";
import { runId } from "./auth";
import { BRANCH_ONE, call, daysFromNow, LABO_ORDERS, laboCatalog, type FormValue, type LaboOrderView, type Paged } from "./laboApi";

/**
 * Seeding for the Labo Phiếu yêu cầu (F-91, BA P1011) specs: a catalog to pick from, a
 * fresh patient, and the multipart body the form posts. Every call is a real
 * HTTP request from the logged-in page.
 */

/** LaboOrderLayout / LaboCaseType on the wire. */
export const Layout = { Classic: 1, RequestSlip: 2 } as const;
export const CaseType = { New: 1, Redo: 2 } as const;

export type Zone = "cervicalMesial" | "cervicalDistal" | "bodyMesial" | "bodyDistal" | "incisalMesial" | "incisalDistal";

export interface Restoration {
  materialId: string;
  onImplant: boolean;
}

export interface SlipToothView {
  toothNumber: number;
  shade: string | null;
  shadeZones: Partial<Record<Zone, string | null>> | null;
  finishLineIds: string[];
  finishLineNames: string[];
  restorations: (Restoration & { materialName: string | null; groupName: string | null })[];
  rhythmId: string | null;
  rhythmName: string | null;
  biteId: string | null;
  biteName: string | null;
}

export interface SlipOrderView extends Omit<LaboOrderView, "teeth"> {
  layout: number;
  labSlipNo: string | null;
  notes: string | null;
  caseType: number;
  rhythmName: string | null;
  biteName: string | null;
  teeth: SlipToothView[];
}

export interface SlipBody {
  patientId: string;
  dentistId?: string;
  /** Nhà cung cấp (P1311): required to send, optional on a draft. */
  supplierId?: string;
  teeth: number[];
  labSlipNo?: string;
  caseType?: number;
  zones?: Partial<Record<Zone, string>>;
  finishLineIds?: string[];
  restorations?: Restoration[];
  /** Kiểu nhịp / Khớp cắn, one each for the whole order (R-1216). */
  rhythmId?: string;
  biteId?: string;
  notes?: string;
  submit: boolean;
}

/** The three fixed groups of Vật liệu & loại phục hình (BA P1011), by their code. */
export const MaterialGroup = { AllCeramic: "TOAN_SU", Alloy: "HOP_KIM", OtherOnImplant: "KHAC_TREN_IMPLANT" } as const;
export type MaterialGroupCode = (typeof MaterialGroup)[keyof typeof MaterialGroup];

export interface SlipGroup {
  id: string;
  name: string;
}

export interface SlipMaterial {
  id: string;
  name: string;
  code: string;
  groupName: string;
}

/**
 * What the Phiếu yêu cầu picks from: a material in each fixed group — the
 * group is the Dịch vụ, the material the Vật liệu under it (R-1216) — two
 * finish lines, and a Kiểu nhịp and a Khớp cắn.
 */
export interface SlipCatalog {
  dentistId: string;
  /** An active supplier of branch 1 (P1311). */
  supplier: { id: string; name: string };
  groups: Record<MaterialGroupCode, SlipGroup>;
  ceramic: SlipMaterial;
  alloy: SlipMaterial;
  implantOther: SlipMaterial;
  finishLines: { id: string; name: string }[];
  rhythm: { id: string; name: string };
  bite: { id: string; name: string };
}

let catalog: SlipCatalog | undefined;

export async function post<T>(page: Page, url: string, json: unknown, branchId = BRANCH_ONE) {
  const res = await call<T & { id: string; name: string }>(page, url, { method: "POST", branchId, json });
  expect(res.status, `${url}: ${res.text}`).toBe(200);
  return res.body as T & { id: string; name: string };
}

/** The branch's three fixed groups — the first list read seeds them. */
export async function fixedGroups(page: Page, branchId = BRANCH_ONE): Promise<Record<MaterialGroupCode, SlipGroup>> {
  const res = await call<Paged<{ id: string; name: string; subGroup: string | null; isSystem: boolean }>>(
    page,
    `/api/v1/app/taxonomies?ClinicBranchId=${branchId}&Group=labo_material&MaxResultCount=1000`,
    { branchId },
  );
  expect(res.status, res.text).toBe(200);
  const pick = (code: MaterialGroupCode): SlipGroup => {
    const row = (res.body.items ?? []).find((one) => one.isSystem && one.subGroup === code);
    expect(row, `fixed group ${code} of ${branchId}`).toBeTruthy();
    return { id: row!.id, name: row!.name };
  };
  return {
    TOAN_SU: pick(MaterialGroup.AllCeramic),
    HOP_KIM: pick(MaterialGroup.Alloy),
    KHAC_TREN_IMPLANT: pick(MaterialGroup.OtherOnImplant),
  };
}

/** Every Dịch vụ of the branch's Dịch vụ Labo — the three fixed groups and those a branch added (P1311). */
export async function laboServices(page: Page, branchId = BRANCH_ONE): Promise<SlipGroup[]> {
  const res = await call<Paged<SlipGroup>>(
    page,
    `/api/v1/app/taxonomies?ClinicBranchId=${branchId}&Group=labo_material&MaxResultCount=1000`,
    { branchId },
  );
  expect(res.status, res.text).toBe(200);
  return (res.body.items ?? []).map((one) => ({ id: one.id, name: one.name }));
}

/** A material with a fresh Mã in one group, as Tạo vật liệu saves it. */
export async function newMaterial(page: Page, group: SlipGroup, name: string, branchId = BRANCH_ONE): Promise<SlipMaterial> {
  const code = `E2E-${runId()}${Math.floor(Math.random() * 1000)}`.slice(0, 50);
  const made = await post<{ code: string }>(
    page,
    "/api/v1/app/labo-materials",
    { code, name, taxonomyId: group.id, clinicBranchId: branchId },
    branchId,
  );
  return { id: made.id, name: made.name, code: made.code, groupName: group.name };
}

/** A Danh mục entry of `group` in branch 1 — Kiểu nhịp, Khớp cắn. */
export async function taxonomy(page: Page, group: string, name: string, branchId = BRANCH_ONE) {
  const made = await post(page, "/api/v1/app/taxonomies", { group, name, clinicBranchId: branchId }, branchId);
  return { id: made.id, name: made.name };
}

export async function slipCatalog(page: Page): Promise<SlipCatalog> {
  if (catalog) return catalog;
  const id = runId();
  const { dentistId, supplierId, supplierName } = await laboCatalog(page, BRANCH_ONE, id);
  const groups = await fixedGroups(page);
  const finishLines = [
    await post(page, "/api/v1/app/taxonomies", { group: "labo_finish_line", name: `Chamfer e2e ${id}`, clinicBranchId: BRANCH_ONE }),
    await post(page, "/api/v1/app/taxonomies", { group: "labo_finish_line", name: `Shoulder e2e ${id}`, clinicBranchId: BRANCH_ONE }),
  ];
  catalog = {
    dentistId,
    supplier: { id: supplierId, name: supplierName },
    groups,
    ceramic: await newMaterial(page, groups.TOAN_SU, `Zirconia e2e ${id}`),
    alloy: await newMaterial(page, groups.HOP_KIM, `Titan e2e ${id}`),
    implantOther: await newMaterial(page, groups.KHAC_TREN_IMPLANT, `Abutment e2e ${id}`),
    finishLines: finishLines.map(({ id: lineId, name }) => ({ id: lineId, name })),
    rhythm: await taxonomy(page, "labo_rhythm", `Nhịp cầu e2e ${id}`),
    bite: await taxonomy(page, "labo_bite", `Cắn chéo e2e ${id}`),
  };
  return catalog;
}

export async function newPatient(page: Page, tag: string): Promise<string> {
  const digits = `${Date.now()}${Math.floor(Math.random() * 1000)}`.slice(-8);
  const patient = await post(page, "/api/v1/app/patients", {
    firstName: `Phiếu YC ${tag}`,
    lastName: "E2E",
    dateOfBirth: null,
    gender: "male",
    phoneNumber: `07${digits}`,
  });
  return patient.id;
}

/** The body as the Phiếu yêu cầu posts it: multipart, `shadeZones.x`, `restorations[i].x`, repeated keys. */
export function slipForm(body: SlipBody): Record<string, FormValue> {
  const form: Record<string, FormValue> = {
    layout: Layout.RequestSlip,
    patientId: body.patientId,
    branchId: BRANCH_ONE,
    dentistId: body.dentistId,
    supplierId: body.supplierId,
    labSlipNo: body.labSlipNo,
    caseType: body.caseType ?? CaseType.New,
    teeth: body.teeth,
    finishLineIds: body.finishLineIds ?? [],
    rhythmId: body.rhythmId,
    biteId: body.biteId,
    quantity: Math.max(body.teeth.length, 1),
    notes: body.notes,
    sentAt: daysFromNow(0),
    dueAt: daysFromNow(5),
    submit: body.submit,
  };
  for (const [zone, value] of Object.entries(body.zones ?? {})) form[`shadeZones.${zone}`] = value;
  (body.restorations ?? []).forEach((r, i) => {
    form[`restorations[${i}].materialId`] = r.materialId;
    form[`restorations[${i}].onImplant`] = r.onImplant;
  });
  return form;
}

export function save(page: Page, body: SlipBody, orderId?: string) {
  return call<SlipOrderView>(page, orderId ? `${LABO_ORDERS}/${orderId}` : LABO_ORDERS, {
    method: orderId ? "PUT" : "POST",
    branchId: BRANCH_ONE,
    form: slipForm(body),
  });
}

export async function readBack(page: Page, id: string): Promise<SlipOrderView> {
  const res = await call<SlipOrderView>(page, `${LABO_ORDERS}/${id}`, { branchId: BRANCH_ONE });
  expect(res.status, res.text).toBe(200);
  return res.body as SlipOrderView;
}

/** A full Phiếu yêu cầu: Mã số, supplier, doctor, two teeth, a restoration, a shade and a finish line. */
export function fullSlip(c: SlipCatalog, patientId: string, labSlipNo: string, extra: Partial<SlipBody> = {}): SlipBody {
  return {
    patientId,
    dentistId: c.dentistId,
    supplierId: c.supplier.id,
    teeth: [16, 17],
    labSlipNo,
    zones: { bodyMesial: "a2" },
    finishLineIds: [c.finishLines[0].id],
    restorations: [{ materialId: c.ceramic.id, onImplant: false }],
    submit: true,
    ...extra,
  };
}

export function slipNo(tag: string): string {
  return `F91-${tag}-${runId()}${Math.floor(Math.random() * 100)}`;
}
