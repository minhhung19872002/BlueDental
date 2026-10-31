import {
  WARRANTY_CARD_KIND,
  type WarrantyCardKind,
  type WarrantyCardRowDto,
} from "@/features/treatment-management/api/planWarrantyApi";
import type { TreatmentStageDto } from "@/features/treatment-management/api/stageApi";
import { isStageDone } from "./stageModel";

/** One Labo order a warranty công đoạn may be worked under (REQ-F4). */
export interface LaboWarrantyOption {
  orderId: string;
  orderCode: string;
  supplierName: string | null;
  /** G25: the order's material, when it names one. */
  materialName: string | null;
  /** Its teeth whose warranty is activated and still valid. */
  teeth: number[];
  /** `YYYY-MM-DD`, the latest of those cards' end dates. */
  until: string;
}

/** The dental cards of a line still valid today. */
export interface DentalCover {
  /** Null when a card holds no tooth: it covers the whole line. */
  teeth: number[] | null;
  until: string;
}

/** What "Thẻ bảo hành áp dụng" can offer for one line. */
export interface LineCover {
  dental: DentalCover | null;
  labo: LaboWarrantyOption[];
}

/** "Thẻ bảo hành áp dụng" as picked on a form. */
export interface WarrantyPick {
  kind: WarrantyCardKind | undefined;
  laboOrderId: string | undefined;
}

const later = (a: string, b: string) => (a.localeCompare(b) >= 0 ? a : b);

function addDental(cover: LineCover, card: WarrantyCardRowDto) {
  const held = cover.dental;
  const tooth = card.toothNumber ?? null;
  if (!held) {
    cover.dental = { teeth: tooth === null ? null : [tooth], until: card.endDate };
    return;
  }
  held.until = later(held.until, card.endDate);
  if (held.teeth === null) return;
  if (tooth === null) held.teeth = null;
  else if (!held.teeth.includes(tooth)) held.teeth.push(tooth);
}

function addLabo(cover: LineCover, card: WarrantyCardRowDto) {
  if (!card.laboOrderId) return;
  const held = cover.labo.find((option) => option.orderId === card.laboOrderId);
  const tooth = card.toothNumber;
  if (!held) {
    cover.labo.push({
      orderId: card.laboOrderId,
      orderCode: card.laboOrderCode ?? "",
      supplierName: card.supplierName ?? null,
      materialName: card.materialName ?? null,
      teeth: tooth == null ? [] : [tooth],
      until: card.endDate,
    });
    return;
  }
  held.until = later(held.until, card.endDate);
  if (tooth != null && !held.teeth.includes(tooth)) held.teeth.push(tooth);
}

/**
 * The valid cards of each line, as the server checks them (WarrantyCover):
 * a card holds while its end date is today or later — both `YYYY-MM-DD`, so
 * a string compare is a date compare (G23).
 */
export function lineCovers(cards: readonly WarrantyCardRowDto[], today: string): Map<string, LineCover> {
  const covers = new Map<string, LineCover>();
  for (const card of cards) {
    if (card.endDate.localeCompare(today) < 0) continue;
    let cover = covers.get(card.lineId);
    if (!cover) {
      cover = { dental: null, labo: [] };
      covers.set(card.lineId, cover);
    }
    if (card.kind === WARRANTY_CARD_KIND.Dental) addDental(cover, card);
    else addLabo(cover, card);
  }
  for (const cover of covers.values()) {
    cover.dental?.teeth?.sort((a, b) => a - b);
    cover.labo.forEach((option) => option.teeth.sort((a, b) => a - b));
  }
  return covers;
}

/** The latest end date any valid card of the line reaches, for the row's tooltip. */
export function coverUntil(cover: LineCover | undefined): string | null {
  if (!cover) return null;
  const dates = [cover.dental?.until, ...cover.labo.map((option) => option.until)].filter(
    (date): date is string => Boolean(date),
  );
  return dates.length === 0 ? null : dates.reduce(later);
}

/**
 * The teeth a pick lets the form take, among `lineTeeth`: null while nothing
 * is picked. A dental card without a tooth covers every tooth of the line.
 */
export function pickedCover(
  cover: LineCover | undefined,
  pick: WarrantyPick,
  lineTeeth: readonly number[],
): number[] | null {
  if (!cover || pick.kind === undefined) return null;
  if (pick.kind === WARRANTY_CARD_KIND.Dental) {
    const teeth = cover.dental?.teeth;
    if (!cover.dental) return [];
    return teeth === null || teeth === undefined ? [...lineTeeth] : lineTeeth.filter((code) => teeth.includes(code));
  }
  const order = cover.labo.find((option) => option.orderId === pick.laboOrderId);
  return order ? lineTeeth.filter((code) => order.teeth.includes(code)) : [];
}

/** Every tooth of the line some valid card covers — what B8 offers. */
export function anyCover(cover: LineCover, lineTeeth: readonly number[]): number[] {
  if (cover.dental && !cover.dental.teeth) return [...lineTeeth];
  const held = new Set([...(cover.dental?.teeth ?? []), ...cover.labo.flatMap((option) => option.teeth)]);
  return lineTeeth.filter((code) => held.has(code));
}

/**
 * The finished công đoạn a new warranty is raised from: the line's newest
 * worked one — not a warranty one, not replaced. Null on a line finished by
 * hand (REQ-B8).
 */
export function warrantySource(stages: readonly TreatmentStageDto[], lineId: string): string | null {
  const source = stages
    .filter((stage) => stage.treatmentServiceId === lineId && !stage.isGuarantee && !stage.isSuperseded)
    .filter(isStageDone)
    .sort((a, b) => b.treatmentDate.localeCompare(a.treatmentDate) || b.creationTime.localeCompare(a.creationTime))[0];
  return source?.id ?? null;
}
