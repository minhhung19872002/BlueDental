import type { ToothSelectionDto } from "@/features/treatment-management/api/consultingApi";
import type { TreatmentStageDto } from "@/features/treatment-management/api/stageApi";
import type {
  TreatmentPlanSlipDto,
  TreatmentServiceDto,
} from "@/features/treatment-management/api/treatmentPlanApi";

/**
 * What "Đặt mới" is raised from: a service line of a plan, reached either
 * through a công đoạn (the stage dialog's Tạo Labo) or picked in the Labo
 * tab's own dialog. The form reads the same four facts either way.
 */
export interface LaboOrderSource {
  planLabel: string;
  serviceName: string;
  dentistId: string | undefined;
  dentistName: string;
  /** The FDI numbers the source names; the order takes every one of them (P2910_03). */
  teeth: string[];
  treatmentPlanId: string | undefined;
  treatmentServiceId: string;
  treatmentStageId: string | undefined;
}

/**
 * The source's teeth as FDI numbers, once each. A tooth's surfaces and a whole
 * jaw's name are how the line reads, not what the Labo order stores: it keeps
 * one card per tooth for the check and the warranty.
 */
export function toothCodes(teeth: ToothSelectionDto[]): string[] {
  return [...new Set(teeth.map((tooth) => String(tooth.toothCode)))];
}

function planLabel(plan: TreatmentPlanSlipDto | null): string {
  return plan ? `${plan.code} - ${plan.dentistName ?? ""}`.trim() : "";
}

export function sourceFromStage(
  plan: TreatmentPlanSlipDto | null,
  stage: TreatmentStageDto,
): LaboOrderSource {
  return {
    planLabel: planLabel(plan),
    serviceName: stage.serviceName ?? stage.name,
    dentistId: stage.staffId,
    dentistName: stage.staffName ?? "",
    teeth: toothCodes(stage.teeth),
    treatmentPlanId: plan?.id,
    treatmentServiceId: stage.treatmentServiceId,
    treatmentStageId: stage.id,
  };
}

/** A line picked in the tab's dialog; the doctor falls back to the plan's. */
export function sourceFromLine(
  plan: TreatmentPlanSlipDto,
  line: TreatmentServiceDto,
): LaboOrderSource {
  return {
    planLabel: planLabel(plan),
    serviceName: line.serviceName ?? line.code,
    dentistId: line.dentistId ?? plan.dentistId,
    dentistName: line.dentistName ?? plan.dentistName ?? "",
    teeth: toothCodes(line.teeth),
    treatmentPlanId: plan.id,
    treatmentServiceId: line.id,
    treatmentStageId: undefined,
  };
}

/**
 * The line picked in the tab's dialog, read back from the form's own fields;
 * null until a line is named. The doctor is whatever the header holds now.
 */
export function sourceFromPick(
  plans: TreatmentPlanSlipDto[],
  planId: string | undefined,
  lineId: string | undefined,
  dentistId: string | undefined,
): LaboOrderSource | null {
  const plan = plans.find((row) => row.id === planId);
  const line = plan?.services.find((row) => row.id === lineId);
  return plan && line ? { ...sourceFromLine(plan, line), dentistId } : null;
}
