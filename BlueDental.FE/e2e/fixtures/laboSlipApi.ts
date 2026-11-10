import { expect, type Page } from "@playwright/test";
import { runId } from "./auth";
import { BRANCH_ONE, call, daysFromNow, LABO_ORDERS, laboCatalog, type FormValue, type LaboOrderView } from "./laboApi";

/**
 * Seeding for the Labo Phiếu yêu cầu (F-91) specs: a catalog to pick from, a
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
}

export interface SlipOrderView extends Omit<LaboOrderView, "teeth"> {
  layout: number;
  labSlipNo: string | null;
  notes: string | null;
  caseType: number;
  teeth: SlipToothView[];
}

export interface SlipBody {
  patientId: string;
  dentistId?: string;
  teeth: number[];
  labSlipNo?: string;
  caseType?: number;
  zones?: Partial<Record<Zone, string>>;
  finishLineIds?: string[];
  restorations?: Restoration[];
  notes?: string;
  submit: boolean;
}

/** What the Phiếu yêu cầu picks from: a group with an implant-able material and a plain one, two finish lines. */
export interface SlipCatalog {
  dentistId: string;
  groupName: string;
  implantMaterial: { id: string; name: string };
  plainMaterial: { id: string; name: string };
  finishLines: { id: string; name: string }[];
}

let catalog: SlipCatalog | undefined;

export async function post<T>(page: Page, url: string, json: unknown, branchId = BRANCH_ONE) {
  const res = await call<T & { id: string; name: string }>(page, url, { method: "POST", branchId, json });
  expect(res.status, `${url}: ${res.text}`).toBe(200);
  return res.body as T & { id: string; name: string };
}

export async function slipCatalog(page: Page): Promise<SlipCatalog> {
  if (catalog) return catalog;
  const id = runId();
  const { dentistId } = await laboCatalog(page, BRANCH_ONE, id);
  const group = await post(page, "/api/v1/app/taxonomies", {
    group: "labo_material",
    name: `Sứ e2e F91 ${id}`,
    clinicBranchId: BRANCH_ONE,
  });
  const implantMaterial = await post<{ allowOnImplant: boolean }>(page, "/api/v1/app/labo-materials", {
    name: `Zirconia e2e ${id}`,
    taxonomyId: group.id,
    clinicBranchId: BRANCH_ONE,
    allowOnImplant: true,
  });
  const plainMaterial = await post(page, "/api/v1/app/labo-materials", {
    name: `Veneer e2e ${id}`,
    taxonomyId: group.id,
    clinicBranchId: BRANCH_ONE,
  });
  const finishLines = [
    await post(page, "/api/v1/app/taxonomies", { group: "labo_finish_line", name: `Chamfer e2e ${id}`, clinicBranchId: BRANCH_ONE }),
    await post(page, "/api/v1/app/taxonomies", { group: "labo_finish_line", name: `Shoulder e2e ${id}`, clinicBranchId: BRANCH_ONE }),
  ];
  catalog = {
    dentistId,
    groupName: group.name,
    implantMaterial: { id: implantMaterial.id, name: implantMaterial.name },
    plainMaterial: { id: plainMaterial.id, name: plainMaterial.name },
    finishLines: finishLines.map(({ id: lineId, name }) => ({ id: lineId, name })),
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
    labSlipNo: body.labSlipNo,
    caseType: body.caseType ?? CaseType.New,
    teeth: body.teeth,
    finishLineIds: body.finishLineIds ?? [],
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

/** A full Phiếu yêu cầu: Mã số, doctor, two teeth, a restoration, a shade and a finish line. */
export function fullSlip(c: SlipCatalog, patientId: string, labSlipNo: string, extra: Partial<SlipBody> = {}): SlipBody {
  return {
    patientId,
    dentistId: c.dentistId,
    teeth: [16, 17],
    labSlipNo,
    zones: { bodyMesial: "a2" },
    finishLineIds: [c.finishLines[0].id],
    restorations: [{ materialId: c.implantMaterial.id, onImplant: false }],
    submit: true,
    ...extra,
  };
}

export function slipNo(tag: string): string {
  return `F91-${tag}-${runId()}${Math.floor(Math.random() * 100)}`;
}
