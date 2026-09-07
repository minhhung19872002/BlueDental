import {
  STAGE_STATUS,
  type TreatmentStageDto,
} from "@/features/treatment-management/api/stageApi";
import {
  SERVICE_LINE_STATUS,
  type TreatmentPlanSlipDto,
  type TreatmentServiceDto,
} from "@/features/treatment-management/api/treatmentPlanApi";
import type { ToothSelectionDto } from "@/features/treatment-management/api/consultingApi";

/**
 * One row of the profile tab's treatment table.
 *
 * The reference drives this table off `patient-timeline`, whose rows are
 * treatment **công đoạn** — a line worked three times is three rows, sharing one
 * date cell per day. A line with no công đoạn yet still gets a row here so its
 * "+" is reachable; whether the reference shows one is unobserved (see
 * docs/clone/unknowns.md).
 */
export interface TreatmentRow extends TreatmentServiceDto {
  /** The công đoạn this row stands for; null for a line that has none yet. */
  stageId: string | null;
  /**
   * Whether this row's công đoạn is finished. The reference's chip and its
   * Công đoạn cell both follow the **công đoạn**, not the line: three công đoạn
   * on one line can read "Hoàn thành", "Đang điều trị", "Đang điều trị".
   */
  stageDone: boolean;
  /** A warranty visit — the reference's `isGuarantee`. */
  isWarranty: boolean;
  createdAt: string;
  /** Nội dung điều trị — the công đoạn's own note. */
  stageNote: string | null;
  /** The công đoạn's teeth, falling back to the line's. */
  rowTeeth: ToothSelectionDto[];
  dentist: string | null;
  assistant: string | null;
  secondDentist: string | null;
  planCode: string;
  /** How many rows the day cell above this one spans; 0 means "covered". */
  daySpan: number;
}

/** Local calendar day of an ISO stamp, for grouping. */
function dayOf(value: string): string {
  return value.slice(0, 10);
}

/**
 * Expands the slips into one row per công đoạn, newest first, and works out how
 * far each day's date cell has to span.
 */
export function buildTreatmentRows(
  plans: TreatmentPlanSlipDto[],
  stages: TreatmentStageDto[],
): TreatmentRow[] {
  const byLine = new Map<string, TreatmentStageDto[]>();
  for (const stage of stages) {
    const held = byLine.get(stage.treatmentServiceId);
    if (held) held.push(stage);
    else byLine.set(stage.treatmentServiceId, [stage]);
  }

  const rows: TreatmentRow[] = [];
  for (const plan of plans) {
    for (const service of plan.services) {
      const base = {
        ...service,
        dentist: plan.dentistName,
        planCode: plan.code,
        daySpan: 0,
      };
      const lineStages = byLine.get(service.id) ?? [];

      if (lineStages.length === 0) {
        rows.push({
          ...base,
          stageId: null,
          stageDone: service.status === SERVICE_LINE_STATUS.Done,
          isWarranty: false,
          createdAt: plan.creationTime,
          stageNote: null,
          rowTeeth: service.teeth,
          assistant: null,
          secondDentist: null,
        });
        continue;
      }

      for (const stage of lineStages) {
        rows.push({
          ...base,
          stageId: stage.id,
          stageDone: stage.status === STAGE_STATUS.Completed,
          isWarranty: stage.isGuarantee,
          createdAt: stage.creationTime,
          stageNote: stage.note,
          rowTeeth: stage.teeth.length > 0 ? stage.teeth : service.teeth,
          dentist: stage.staffName ?? plan.dentistName,
          assistant: stage.subStaffName,
          secondDentist: stage.secondStaffName,
        });
      }
    }
  }

  rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  // The date cell spans its whole day, the way the reference sets rowSpan.
  for (let index = 0; index < rows.length; index += 1) {
    const day = dayOf(rows[index].createdAt);
    if (index > 0 && dayOf(rows[index - 1].createdAt) === day) continue;

    let span = 1;
    while (index + span < rows.length && dayOf(rows[index + span].createdAt) === day) span += 1;
    rows[index].daySpan = span;
  }

  return rows;
}

/**
 * Re-works the day spans over a filtered list.
 *
 * The spans are positional: dropping rows in the middle of a day would leave a
 * cell claiming more rows than are still there, and AntD would swallow the next
 * day's date.
 */
export function regroupByDay(rows: TreatmentRow[]): TreatmentRow[] {
  const next = rows.map((row) => ({ ...row, daySpan: 0 }));

  for (let index = 0; index < next.length; index += 1) {
    const day = dayOf(next[index].createdAt);
    if (index > 0 && dayOf(next[index - 1].createdAt) === day) continue;

    let span = 1;
    while (index + span < next.length && dayOf(next[index + span].createdAt) === day) span += 1;
    next[index].daySpan = span;
  }

  return next;
}
