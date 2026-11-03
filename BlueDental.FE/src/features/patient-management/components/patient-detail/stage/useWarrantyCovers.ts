import { useMemo } from "react";
import {
  usePlanWarrantyOverview,
  type WarrantyCardKind,
  type WarrantyServiceRowDto,
} from "@/features/treatment-management/api/planWarrantyApi";
import type { TreatmentServiceDto } from "@/features/treatment-management/api/treatmentPlanApi";
import type { StageDraft } from "./stageDraft";
import { toothCodes, type StageItem } from "./stageModel";
import { anyCover, coverUntil, lineCovers, pickedCover, type LineCover } from "./stageWarranty";

/**
 * The slip's valid warranty cards, read for the stage panel: which lines TIẾP
 * TỤC BẢO HÀNH offers (REQ-B8), what "Thẻ bảo hành áp dụng" can pick on each
 * (REQ-F3/F4), and the date a finished row's button names (REQ-A9).
 */
export function useWarrantyCovers(planId: string | undefined, services: readonly TreatmentServiceDto[], open: boolean) {
  const overview = usePlanWarrantyOverview(open ? (planId ?? "") : "");

  const covers = useMemo(
    () => (overview.data ? lineCovers(overview.data.cards, overview.data.today) : new Map<string, LineCover>()),
    [overview.data],
  );

  /** Each line's teeth some valid card covers — the B8 cards of TIẾP TỤC BẢO HÀNH. */
  const warrantable = useMemo(() => {
    const teeth = new Map<string, number[]>();
    for (const line of services) {
      const cover = covers.get(line.id);
      if (cover) teeth.set(line.id, anyCover(cover, toothCodes(line.teeth)));
    }
    return teeth;
  }, [covers, services]);

  const rows = useMemo(
    () => new Map<string, WarrantyServiceRowDto>((overview.data?.rows ?? []).map((row) => [row.lineId, row])),
    [overview.data],
  );

  return {
    warrantable,
    coverOf: (lineId: string): LineCover | undefined => covers.get(lineId),
    untilOf: (lineId: string): string | null => coverUntil(covers.get(lineId)),
    /** "Hoàn thành dd/mm/yyyy · BS. …" under the service name. */
    rowOf: (lineId: string): WarrantyServiceRowDto | undefined => rows.get(lineId),
    /**
     * The draft a card pick leaves: every tooth the picked card covers ticked,
     * so the doctor only unticks what this visit does not touch. No kind (the
     * picked card clicked again) clears the pick, its order and its teeth.
     */
    pickPatch: (item: StageItem, kind: WarrantyCardKind | undefined, laboOrderId: string | undefined): Partial<StageDraft> => {
      const covered = pickedCover(covers.get(item.line.id), { kind, laboOrderId }, toothCodes(item.teeth)) ?? [];
      return { warrantyKind: kind, warrantyLaboOrderId: kind === undefined ? undefined : laboOrderId, teeth: covered };
    },
    /** The teeth a form can tick: those the picked card covers; none before a pick. */
    offeredTeeth: (item: StageItem, draft: StageDraft) => {
      if (item.stages.length > 0) return item.teeth;
      const pick = { kind: draft.warrantyKind, laboOrderId: draft.warrantyLaboOrderId };
      const covered = pickedCover(covers.get(item.line.id), pick, toothCodes(item.teeth)) ?? [];
      return item.teeth.filter((tooth) => covered.includes(tooth.toothCode));
    },
  };
}

export type WarrantyCovers = ReturnType<typeof useWarrantyCovers>;
