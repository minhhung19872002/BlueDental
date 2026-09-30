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

/**
 * One card in the Chi tiết column, and the form it opens — one per service
 * line on every tab (the project owner's rule, 2026-09-30: a line worked in two
 * chains still reads as one service).
 */
export interface StageItem {
  /** The line's id on `add`; `"continue:<line>"` / `"continueWarranty:<line>"` otherwise. */
  id: string;
  tab: StageTab;
  line: TreatmentServiceDto;
  /** The open công đoạn continued from this card, one per chain; empty on `add`. */
  stages: TreatmentStageDto[];
  /**
   * The teeth the form can take: on `add` the line's teeth that are still free
   * (the doctor picks among them), on the continue tabs those of its open công
   * đoạn (each chain keeps its teeth — the server refuses a continue whose
   * teeth differ — so they are picked a chain at a time).
   */
  teeth: ToothSelectionDto[];
  /**
   * Every tooth the card and the form print: the line's. Those not in `teeth`
   * — already taken by a công đoạn, or not in the chains being continued —
   * stay on show, faded and inert, rather than dropping out.
   */
  shownTeeth: ToothSelectionDto[];
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
    for (const tooth of stageTeeth(stage, line)) covered.add(tooth.toothCode);
  }
  return covered;
}

/** The teeth a công đoạn holds; one written with none stood for the whole line. */
export const stageTeeth = (stage: TreatmentStageDto, line: TreatmentServiceDto): ToothSelectionDto[] =>
  stage.teeth.length > 0 ? stage.teeth : line.teeth;

/** Each tooth once, in the order first met. */
function uniqueTeeth(teeth: ToothSelectionDto[]): ToothSelectionDto[] {
  const seen = new Set<number>();
  return teeth.filter((tooth) => !seen.has(tooth.toothCode) && Boolean(seen.add(tooth.toothCode)));
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
 * Every card of every tab. A line appears under `add` while it has free teeth,
 * and under the continue tab of its kind while it has an open công đoạn there
 * — once, however many chains are open: the reference lists each chain as its
 * own card, which read as the same service twice. So one line can sit in two
 * tabs at once: 22 still to start, 21·23 being continued.
 */
export function buildStageItems(
  services: TreatmentServiceDto[],
  stages: TreatmentStageDto[],
): Record<StageTab, StageItem[]> {
  const byLine = stagesByLine(stages);
  const lineById = new Map(services.map((line) => [line.id, line]));

  const shownOf = (line: TreatmentServiceDto, teeth: ToothSelectionDto[]) =>
    line.teeth.length > 0 ? line.teeth : teeth;

  const add = services.flatMap((line): StageItem[] => {
    if (!OPEN_LINE.has(line.status)) return [];
    const teeth = remainingTeeth(line, byLine.get(line.id) ?? []);
    return teeth.length === 0
      ? []
      : [{ id: line.id, tab: "add", line, stages: [], teeth, shownTeeth: shownOf(line, teeth) }];
  });

  const continuing = (warranty: boolean): StageItem[] => {
    const tab: StageTab = warranty ? "continueWarranty" : "continue";
    const open = new Map<string, TreatmentStageDto[]>();
    for (const stage of stages) {
      if (!lineById.has(stage.treatmentServiceId) || !isStageOpen(stage) || stage.isGuarantee !== warranty) continue;
      const held = open.get(stage.treatmentServiceId);
      if (held) held.push(stage);
      else open.set(stage.treatmentServiceId, [stage]);
    }

    // Cards in the slip's line order, as on `add`.
    return services.flatMap((line): StageItem[] => {
      const chains = open.get(line.id);
      if (!chains) return [];
      const teeth = uniqueTeeth(chains.flatMap((stage) => stageTeeth(stage, line)));
      return [{ id: `${tab}:${line.id}`, tab, line, stages: chains, teeth, shownTeeth: shownOf(line, teeth) }];
    });
  };

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

/**
 * A công đoạn's steps as a checklist shows them. A step the catalog no longer
 * has comes back without a name (before 2026-09-24 every edit of a service
 * re-created its steps under new ids); it is left off the list rather than
 * drawn as a blank box. Only the display drops it — a save still sends every
 * step the công đoạn holds.
 */
export function namedSteps(items: TreatmentStageDto["serviceItems"]): { id: string; name: string }[] {
  return items
    .filter((item) => item.name.trim().length > 0)
    .map((item) => ({ id: item.catalogServiceStageId, name: item.name }));
}

/**
 * The công đoạn a continue form will write, given the teeth it has picked:
 * each chain whose teeth are all picked. A chain goes on whole or not at all.
 */
export function stagesToContinue(item: StageItem, picked: number[]): TreatmentStageDto[] {
  const wanted = new Set(picked);
  return item.stages.filter((stage) =>
    stageTeeth(stage, item.line).every((tooth) => wanted.has(tooth.toothCode)),
  );
}

/**
 * A pick on a continue card snapped to whole chains: any chain with a tooth in
 * `codes` comes in with all its teeth. `add` picks tooth by tooth.
 */
export function snapToChains(item: StageItem, codes: number[]): number[] {
  if (item.tab === "add") return codes;
  const wanted = new Set(codes);
  const snapped = new Set<number>();
  for (const stage of item.stages) {
    const teeth = toothCodes(stageTeeth(stage, item.line));
    if (teeth.some((code) => wanted.has(code))) teeth.forEach((code) => snapped.add(code));
  }
  return toothCodes(item.teeth).filter((code) => snapped.has(code));
}

/**
 * Tapping one tooth of a continue card: its chain comes in, or goes out, whole.
 * On `add` it is that tooth alone.
 */
export function toggleTooth(item: StageItem, picked: number[], code: number): number[] {
  if (item.tab === "add") {
    return picked.includes(code) ? picked.filter((each) => each !== code) : [...picked, code];
  }
  const chain = item.stages.find((stage) =>
    stageTeeth(stage, item.line).some((tooth) => tooth.toothCode === code),
  );
  if (!chain) return picked;
  const teeth = toothCodes(stageTeeth(chain, item.line));
  return picked.includes(code)
    ? picked.filter((each) => !teeth.includes(each))
    : snapToChains(item, [...picked, ...teeth]);
}

/** Tooth codes, in the order the teeth were given. */
export const toothCodes = (teeth: ToothSelectionDto[]): number[] =>
  teeth.map((tooth) => tooth.toothCode);

/** The teeth among `teeth` whose codes are in `codes`, surfaces kept. */
export function pickTeeth(teeth: ToothSelectionDto[], codes: number[]): ToothSelectionDto[] {
  const wanted = new Set(codes);
  return teeth.filter((tooth) => wanted.has(tooth.toothCode));
}
