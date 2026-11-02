import { expect, type Page } from "@playwright/test";
import { runId } from "./auth";
import { call, clinicToday, freshSlip, serviceLine, STAGES, type LaboLine, type LineOptions } from "./laboApi";
import { doctorId } from "./warrantyApi";

/** Shared by the F-88 specs: stage-date-lock-api (HTTP) and stage-date-lock (UI). */

export interface StageDto {
  id: string;
  treatmentDate: string;
  status: number;
  isSuperseded: boolean;
  isDateLocked: boolean;
  continuedToothCodes: number[];
}

export async function freshLine(page: Page, options: Omit<LineOptions, "planId">): Promise<LaboLine> {
  return serviceLine(page, { ...options, planId: await freshSlip(page, runId()) });
}

/** Ngày điều trị `days` from the clinic's today, yyyy-MM-dd. */
export function clinicDay(days: number): string {
  return new Date(Date.parse(`${clinicToday()}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}

/** A plain công đoạn on the line, worked on `treatmentDate`. */
export async function postDated(page: Page, line: LaboLine, teeth: number[], treatmentDate: string): Promise<string> {
  const made = await call<StageDto>(page, STAGES, {
    method: "POST",
    branchId: line.branchId,
    json: {
      patientId: line.patientId,
      clinicBranchId: line.branchId,
      treatmentId: line.planId,
      treatmentServiceId: line.lineId,
      serviceId: line.serviceId,
      name: line.serviceName,
      note: `e2e khoá ngày ${runId()}`,
      staffId: await doctorId(page, line.branchId),
      treatmentDate,
      teeth: teeth.map((toothCode) => ({ toothCode, selected: true })),
    },
  });
  expect(made.status, made.text).toBe(200);
  return made.body.id!;
}
