import { expect, type Page } from "@playwright/test";
import { runId } from "./auth";
import { call, PLANS, STAGES, type ApiResult, type LaboLine, type Paged } from "./laboApi";

/**
 * The slip's Bảo hành endpoints and the warranty công đoạn as the specs drive
 * them (P3110, F-86): real requests from inside the logged-in page, like
 * {@link call}. Nothing is intercepted.
 */

/** WarrantyCardKind on the wire: the card a warranty công đoạn is worked under. */
export const WarrantyKind = { Dental: 1, Labo: 2 } as const;

export interface DentalCardInput {
  toothNumber: number | null;
  startDate: string;
  months?: number | null;
  conditions?: string;
}

/** The pick a warranty công đoạn is posted with (REQ-B8, F3..F5). */
export interface WarrantyPick {
  /** The finished công đoạn it is raised from; none for a line finished by hand. */
  source?: string | null;
  kind: number | null;
  laboOrderId?: string | null;
}

export interface StageView {
  id: string;
  isGuarantee: boolean;
  warrantyRootStageId: string | null;
  warrantyKind: number | null;
  warrantyLaboOrderId: string | null;
}

export const dentalWarrantyUrl = (line: LaboLine) =>
  `${PLANS}/${line.planId}/services/${line.lineId}/warranty`;

/** "Bảo hành dịch vụ": the line's dental cards. */
export function activateDental<T = unknown>(
  page: Page,
  line: LaboLine,
  cards: DentalCardInput[],
): Promise<ApiResult<T>> {
  return call<T>(page, dentalWarrantyUrl(line), {
    method: "POST",
    branchId: line.branchId,
    json: { cards },
  });
}

/** "Hoàn thành" on the slip's line, by hand. */
export function completeLine(page: Page, line: LaboLine): Promise<ApiResult<unknown>> {
  return call(page, `${PLANS}/${line.planId}/services/${line.lineId}/complete`, {
    method: "POST",
    branchId: line.branchId,
  });
}

export async function doctorId(page: Page, branchId: string): Promise<string> {
  const res = await call<Paged<{ id: string }>>(page, "/api/v1/app/staff?MaxResultCount=1&Role=1", {
    branchId,
  });
  expect(res.status, res.text).toBe(200);
  return res.body.items![0].id;
}

/** `POST treatment-stages` for the line — a plain công đoạn, or with `warranty` a warranty one. */
export async function postStage(
  page: Page,
  line: LaboLine,
  teeth: number[],
  warranty?: WarrantyPick,
): Promise<ApiResult<StageView>> {
  return call<StageView>(page, STAGES, {
    method: "POST",
    branchId: line.branchId,
    json: {
      patientId: line.patientId,
      clinicBranchId: line.branchId,
      treatmentId: line.planId,
      treatmentServiceId: line.lineId,
      serviceId: line.serviceId,
      name: line.serviceName,
      note: `e2e ${warranty ? "bảo hành" : "gốc"} ${runId()}`,
      staffId: await doctorId(page, line.branchId),
      teeth: teeth.map((toothCode) => ({ toothCode, selected: true })),
      ...(warranty
        ? {
            isGuarantee: true,
            warrantySourceStageId: warranty.source ?? null,
            warrantyKind: warranty.kind,
            warrantyLaboOrderId: warranty.laboOrderId ?? null,
          }
        : {}),
    },
  });
}

/** {@link postStage} that must succeed; returns the công đoạn's id. */
export async function addStage(
  page: Page,
  line: LaboLine,
  teeth: number[],
  warranty?: WarrantyPick,
): Promise<string> {
  const made = await postStage(page, line, teeth, warranty);
  expect(made.status, made.text).toBe(200);
  return made.body.id!;
}

export async function closeStage(page: Page, line: LaboLine, id: string): Promise<void> {
  const closed = await call(page, `${STAGES}/${id}/complete`, {
    method: "POST",
    branchId: line.branchId,
  });
  expect(closed.status, closed.text).toBe(200);
}
