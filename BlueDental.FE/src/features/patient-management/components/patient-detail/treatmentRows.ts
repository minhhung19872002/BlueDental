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
import {
  DISCOUNT_TYPE,
  type PatientDiagnosisDto,
  type ToothSelectionDto,
} from "@/features/treatment-management/api/consultingApi";
import { warrantyState, type WarrantyState } from "./stage/stageModel";

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
   * Which kind of row this is. The reference's timeline returns `type: "stage"`
   * and `type: "re_examination"` — a tái khám is a row of its own beside the
   * công đoạn, carrying code REX01, no status chip of the line's, and neither a
   * Công đoạn nor a Chăm sóc cell. A `diagnosis` row is a phiếu chẩn đoán shown
   * under the "Các chẩn đoán" chip only (staging, 2026-09-28): no code link, a
   * grey "Chẩn đoán" chip, the slip's note as Nội dung điều trị, and a payment
   * button that does nothing.
   */
  kind: "stage" | "reExamination" | "diagnosis";
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
  /**
   * What the Công đoạn cell offers once this row's công đoạn is finished —
   * see {@link warrantyState}. `none` on a row still being worked.
   */
  warranty: WarrantyState;
  /**
   * The day the Ngày column prints. A công đoạn row carries its Ngày điều trị
   * ("YYYY-MM-DD", BA 2026-10-09); every other row its creation time.
   */
  createdAt: string;
  /** When the row was written — orders the rows inside one day. */
  writtenAt: string;
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
  diagnoses: PatientDiagnosisDto[] = [],
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
          warranty: { kind: "none" },
          createdAt: plan.creationTime,
          writtenAt: plan.creationTime,
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
          // SL is the công đoạn's own count of teeth — staging's timeline
          // prints 3 on a warranty of 11·21·22 whose line holds four.
          quantity: stage.teeth.length > 0 ? stage.teeth.length : service.quantity,
          stageId: stage.id,
          stageDone: stage.status === STAGE_STATUS.Completed,
          isWarranty: stage.isGuarantee,
          warranty: warrantyState(stage, service, lineStages),
          createdAt: stage.treatmentDate,
          writtenAt: stage.creationTime,
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
      warranty: { kind: "none" },
      createdAt: visit.treatmentDate,
      writtenAt: visit.creationTime,
      stageNote: visit.note,
      rowTeeth: visit.teeth,
      quantity: visit.quantity,
      serviceName: visit.serviceName ?? held.service.serviceName,
      dentist: visit.staffName,
      assistant: visit.subStaffName,
      secondDentist: visit.secondStaffName,
    });
  }

  for (const slip of diagnoses) rows.push(diagnosisRow(slip));

  rows.sort(
    (a, b) =>
      dayOf(b.createdAt).localeCompare(dayOf(a.createdAt)) ||
      b.writtenAt.localeCompare(a.writtenAt),
  );

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

/**
 * A phiếu chẩn đoán as a treatment-table row. It is no service line, so the
 * money and stage columns of {@link TreatmentServiceDto} are filled with the
 * empty values the table never prints for this kind: the row shows the
 * diagnosis name, its note, teeth and doctors, and nothing else (staging,
 * 2026-09-28, patient HN8509 / CD05).
 */
function diagnosisRow(slip: PatientDiagnosisDto): TreatmentRow {
  return {
    id: slip.id,
    treatmentPlanId: "",
    serviceId: slip.diagnosisId,
    sourceAdviseId: null,
    code: slip.code,
    originalPrice: 0,
    price: 0,
    quantity: Math.max(slip.teeth.length, 1),
    discountType: DISCOUNT_TYPE.None,
    discountValue: 0,
    grossAmount: 0,
    discountAmount: 0,
    effectiveAmount: 0,
    serviceDiscountAmount: 0,
    planDiscountShare: 0,
    planVoucherShare: 0,
    chargedAmount: 0,
    taxPercent: 0,
    taxAmount: 0,
    payableAmount: 0,
    status: SERVICE_LINE_STATUS.Created,
    sortOrder: 0,
    replacedId: null,
    teeth: slip.teeth,
    serviceName: slip.diagnosisName,
    stageCount: 0,
    completedStageCount: 0,
    warrantyDays: 0,
    serviceSteps: [],
    stageNotes: [],
    stagedTeeth: [],
    paidAmount: 0,
    outstandingAmount: 0,
    afterCareStatus: null,
    labOrders: [],
    diagnosisId: slip.diagnosisId,
    diagnosisName: slip.diagnosisName,
    dentistId: null,
    dentistName: null,
    note: slip.note,
    diagnoserStaffId: slip.staffId,
    diagnoserName: slip.staffName,
    secondDiagnoserStaffId: slip.secondStaffId,
    secondDiagnoserName: slip.secondStaffName,
    consultantStaffId: null,
    consultantName: null,
    secondConsultantStaffId: null,
    secondConsultantName: null,
    kind: "diagnosis",
    recallCode: null,
    planCode: slip.code,
    daySpan: 0,
    stageId: null,
    stageDone: false,
    isWarranty: false,
    warranty: { kind: "none" },
    createdAt: slip.creationTime,
    writtenAt: slip.creationTime,
    stageNote: slip.note,
    rowTeeth: slip.teeth,
    dentist: slip.staffName,
    assistant: null,
    secondDentist: slip.secondStaffName,
  };
}
