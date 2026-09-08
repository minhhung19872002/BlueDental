import {
  STAGE_STATUS,
  type PatientReExaminationDto,
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
  /**
   * Which kind of row this is. The reference's timeline returns two —
   * `type: "stage"` and `type: "re_examination"` — and a tái khám is a row of
   * its own beside the công đoạn, carrying code REX01, no status chip of the
   * line's, and neither a Công đoạn nor a Chăm sóc cell.
   */
  kind: "stage" | "reExamination";
  /** REX01 on a tái khám row; null on a công đoạn row. */
  recallCode: string | null;
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
 * Expands the slips into one row per công đoạn, newest first.
 *
 * The day spans are {@link regroupByDay}'s job, over the rows actually being
 * rendered.
 */
export function buildTreatmentRows(
  plans: TreatmentPlanSlipDto[],
  stages: TreatmentStageDto[],
  reExaminations: PatientReExaminationDto[] = [],
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
        kind: "stage" as const,
        recallCode: null,
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

  /*
   * Tái khám rows, folded in beside the công đoạn. Each hangs off the same
   * service line as the công đoạn it was raised from, so it borrows the line for
   * its money and its SL and overrides everything the reference shows
   * differently: its own REX code, its own chosen teeth, its own note and staff,
   * and no Công đoạn or Chăm sóc cell at all.
   */
  const lineById = new Map(
    plans.flatMap((plan) => plan.services.map((service) => [service.id, { plan, service }] as const)),
  );

  for (const visit of reExaminations) {
    const held = lineById.get(visit.treatmentServiceId);
    if (!held) continue;

    rows.push({
      ...held.service,
      kind: "reExamination",
      recallCode: visit.code,
      planCode: held.plan.code,
      daySpan: 0,
      stageId: null,
      stageDone: false,
      isWarranty: false,
      createdAt: visit.creationTime,
      stageNote: visit.note,
      rowTeeth: visit.teeth,
      quantity: visit.quantity,
      serviceName: visit.serviceName ?? held.service.serviceName,
      dentist: visit.staffName,
      assistant: visit.subStaffName,
      secondDentist: visit.secondStaffName,
    });
  }

  rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  // The spans are left to regroupByDay: they are positional, and every caller
  // filters and pages this list before rendering it, so a span worked out here
  // would be overwritten anyway.
  return rows;
}

/**
 * Works out the day spans over exactly the rows about to be rendered.
 *
 * The spans are positional, so this has to run **after** filtering *and* after
 * the page slice. Dropping rows from the middle of a day leaves a cell claiming
 * more rows than are still there and AntD swallows the next day's date; slicing
 * a page can also cut a day's first row away, leaving the rest of that day with
 * no date cell at all.
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
