import { STAGE_STATUS, type TreatmentStageDto } from "@/features/treatment-management/api/stageApi";
import {
  SERVICE_LINE_STATUS,
  type TreatmentServiceDto,
  type TreatmentServiceStatus,
} from "@/features/treatment-management/api/treatmentPlanApi";
import type { ToothSelectionDto } from "@/features/treatment-management/api/consultingApi";

/**
 * The three tabs of "Chi tiết phiếu", keyed as the reference keys them:
 * `add` — lines with teeth no công đoạn holds yet; `continue` — ordinary công
 * đoạn still being worked; `continueWarranty` — warranty công đoạn still being
 * worked. Read off the reference's stage chunk 2026-09-24.
 */
export type StageTab = "add" | "continue" | "continueWarranty";

export const STAGE_TABS: readonly StageTab[] = ["add", "continue", "continueWarranty"];

/** One card in the Chi tiết column, and the form it opens. */
export interface StageItem {
  /** The line's id on `add`, the công đoạn's id on the two continue tabs. */
  id: string;
  tab: StageTab;
  line: TreatmentServiceDto;
  /** The công đoạn being continued; null on `add`. */
  stage: TreatmentStageDto | null;
  /**
   * The teeth the form offers: on `add` the line's teeth that are still free
   * (the doctor picks among them), on the continue tabs the công đoạn's own
   * (locked — the reference refuses a continue whose teeth differ).
   */
  teeth: ToothSelectionDto[];
}

/**
 * The line statuses the reference asks for when it opens the dialog —
 * `status=created,inProgress,guarantee`. A finished, cancelled or converted line
 * takes no new công đoạn.
 */
const OPEN_LINE: ReadonlySet<TreatmentServiceStatus> = new Set([
  SERVICE_LINE_STATUS.Created,
  SERVICE_LINE_STATUS.InProgress,
  SERVICE_LINE_STATUS.Warranty,
]);

export const isStageDone = (stage: TreatmentStageDto): boolean =>
  stage.status === STAGE_STATUS.Completed;

/** Still being worked: not finished, and not continued by a later công đoạn. */
export const isStageOpen = (stage: TreatmentStageDto): boolean =>
  !stage.isSuperseded && !isStageDone(stage);

/**
 * Tooth codes a line's công đoạn already hold. A công đoạn written with no
 * teeth predates per-tooth công đoạn and stood for the whole line — the server
 * counts it the same way (StageTeethPolicy.CoveredTeeth).
 */
export function coveredTeeth(line: TreatmentServiceDto, lineStages: TreatmentStageDto[]): Set<number> {
  const covered = new Set<number>();
  for (const stage of lineStages) {
    const teeth = stage.teeth.length > 0 ? stage.teeth : line.teeth;
    for (const tooth of teeth) covered.add(tooth.toothCode);
  }
  return covered;
}

/** The line's teeth that no công đoạn holds yet — what "Thêm công đoạn" offers. */
export function remainingTeeth(
  line: TreatmentServiceDto,
  lineStages: TreatmentStageDto[],
): ToothSelectionDto[] {
  const covered = coveredTeeth(line, lineStages);
  return line.teeth.filter((tooth) => !covered.has(tooth.toothCode));
}

function stagesByLine(stages: TreatmentStageDto[]): Map<string, TreatmentStageDto[]> {
  const byLine = new Map<string, TreatmentStageDto[]>();
  for (const stage of stages) {
    const held = byLine.get(stage.treatmentServiceId);
    if (held) held.push(stage);
    else byLine.set(stage.treatmentServiceId, [stage]);
  }
  return byLine;
}

/**
 * Every card of every tab, the way the reference builds them
 * (`buildCreateStageItems`, `buildContinueStageItems`,
 * `buildContinueWarrantyStageItems`): a line appears under `add` while it has
 * free teeth, and each open công đoạn — one per chain — appears under the
 * continue tab of its kind. So one line can sit in two tabs at once: 22 still
 * to start, 21·23 being continued.
 */
export function buildStageItems(
  services: TreatmentServiceDto[],
  stages: TreatmentStageDto[],
): Record<StageTab, StageItem[]> {
  const byLine = stagesByLine(stages);
  const lineById = new Map(services.map((line) => [line.id, line]));

  const add = services.flatMap((line): StageItem[] => {
    if (!OPEN_LINE.has(line.status)) return [];
    const teeth = remainingTeeth(line, byLine.get(line.id) ?? []);
    return teeth.length === 0 ? [] : [{ id: line.id, tab: "add", line, stage: null, teeth }];
  });

  const continuing = (warranty: boolean): StageItem[] =>
    stages.flatMap((stage): StageItem[] => {
      const line = lineById.get(stage.treatmentServiceId);
      if (!line || !isStageOpen(stage) || stage.isGuarantee !== warranty) return [];
      return [
        {
          id: stage.id,
          tab: warranty ? "continueWarranty" : "continue",
          line,
          stage,
          teeth: stage.teeth.length > 0 ? stage.teeth : line.teeth,
        },
      ];
    });

  return { add, continue: continuing(false), continueWarranty: continuing(true) };
}

/**
 * The reference's `hasOpenWarrantyStageForService`: a warranty of the line
 * that is neither continued nor finished. While one stands, no Bảo hành on
 * that line can be pressed.
 */
export function hasOpenWarranty(lineStages: TreatmentStageDto[]): boolean {
  return lineStages.some((stage) => stage.isGuarantee && isStageOpen(stage));
}

/** Local calendar day, so a warranty counts the days the clinic counts. */
function dayNumber(value: Date): number {
  return Math.floor(
    Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()) / 86_400_000,
  );
}

/**
 * The reference's `getWarrantyDaysRemaining`: the period less the whole days
 * since the công đoạn was worked; null when the service carries no warranty.
 */
export function warrantyDaysLeft(warrantyDays: number, workedAt: string, now: Date): number | null {
  if (warrantyDays <= 0) return null;
  return warrantyDays - (dayNumber(now) - dayNumber(new Date(workedAt)));
}

/**
 * What a history row (or a treatment-table row) offers once its công đoạn is
 * finished, as the reference draws it:
 *
 * - `none` — not finished, or continued by a later one: no warranty control;
 * - `noWarranty` — the service carries no warranty: a grey "Không bảo hành";
 * - `available` — a live Bảo hành, titled "Còn n ngày bảo hành";
 * - `blocked` — Bảo hành shown but disabled: another warranty of the line is
 *   still open, or the period ran out.
 */
export type WarrantyState =
  | { kind: "none" }
  | { kind: "noWarranty" }
  | { kind: "available"; daysLeft: number }
  | { kind: "blocked"; reason: "openWarranty" | "expired" };

export function warrantyState(
  stage: TreatmentStageDto,
  line: TreatmentServiceDto,
  lineStages: TreatmentStageDto[],
  now: Date = new Date(),
): WarrantyState {
  if (stage.isSuperseded || !isStageDone(stage)) return { kind: "none" };

  const daysLeft = warrantyDaysLeft(line.warrantyDays, stage.creationTime, now);
  if (daysLeft === null) return { kind: "noWarranty" };
  if (hasOpenWarranty(lineStages)) return { kind: "blocked", reason: "openWarranty" };
  if (daysLeft <= 0) return { kind: "blocked", reason: "expired" };
  return { kind: "available", daysLeft };
}

/**
 * The teeth "Tạo bảo hành" offers off `source`: those of the ordinary công
 * đoạn its warranty chain descends from, not the narrower set a warranty may
 * have taken — the project owner's rule, which staging shows whenever that
 * root covers the whole line. With no root on record (an older warranty) the
 * line's teeth stand in, which is what the reference itself offers.
 */
export function warrantyCandidates(
  source: TreatmentStageDto,
  line: TreatmentServiceDto,
  lineStages: TreatmentStageDto[],
): ToothSelectionDto[] {
  const rootId = source.isGuarantee ? source.warrantyRootStageId : source.id;
  const root = lineStages.find((stage) => stage.id === rootId);
  if (root && root.teeth.length > 0) return root.teeth;
  return line.teeth.length > 0 ? line.teeth : source.teeth;
}

/** Tooth codes, in the order the teeth were given. */
export const toothCodes = (teeth: ToothSelectionDto[]): number[] =>
  teeth.map((tooth) => tooth.toothCode);

/** The teeth among `teeth` whose codes are in `codes`, surfaces kept. */
export function pickTeeth(teeth: ToothSelectionDto[], codes: number[]): ToothSelectionDto[] {
  const wanted = new Set(codes);
  return teeth.filter((tooth) => wanted.has(tooth.toothCode));
}
