import { t } from "@/lib/i18n";
import {
  LABO_BLOCK_KIND,
  type LaboBlockKind,
  type LaboFormBlockDto,
  type LaboSystemBlockKind,
} from "@/features/labo/api/laboFormTemplateApi";

/**
 * The layout a Mẫu phiếu gives the Phiếu yêu cầu (F-94): the slip's own
 * blocks, renamed, resized, reordered or hidden, with the template's sections
 * among them. Shared by the builder, the slip and the printed sheet.
 */

/** The i18n key of each system block's own name, as the fixed slip heads it. */
export const BLOCK_NAME: Record<LaboSystemBlockKind, string> = {
  [LABO_BLOCK_KIND.Info]: "Labo:Slip:Info",
  [LABO_BLOCK_KIND.Restoration]: "Labo:Slip:Restoration",
  [LABO_BLOCK_KIND.Shade]: "Labo:Slip:Shade",
  [LABO_BLOCK_KIND.Teeth]: "Labo:Slip:Teeth",
  [LABO_BLOCK_KIND.FinishLine]: "Labo:Slip:FinishLine",
  [LABO_BLOCK_KIND.Notes]: "Labo:Slip:Request",
};

/**
 * Loại phục hình's three cards (R-1202), gone since R-1216 made it one Dịch vụ
 * → Vật liệu picker: only a layout saved in between still holds them.
 */
const RESTORATION_CARDS: readonly LaboBlockKind[] = [
  LABO_BLOCK_KIND.AllCeramic,
  LABO_BLOCK_KIND.Alloy,
  LABO_BLOCK_KIND.OtherOnImplant,
];

const isCard = (kind: LaboBlockKind): boolean => RESTORATION_CARDS.includes(kind);

/**
 * The system blocks as the fixed slip places them (R-1216): Thông tin phiếu
 * across, then three columns read left to right, each block under the one
 * above it in its column — Loại phục hình, Màu răng, Chỉ định, then Đường hoàn
 * tất (with Kiểu nhịp and Khớp cắn) under Loại phục hình — and Yêu cầu last.
 * What a new template starts from; the server lays a template without a
 * layout the same way.
 */
export const SYSTEM_BLOCKS: readonly { kind: LaboSystemBlockKind; span: number }[] = [
  { kind: LABO_BLOCK_KIND.Info, span: 3 },
  { kind: LABO_BLOCK_KIND.Restoration, span: 1 },
  { kind: LABO_BLOCK_KIND.Shade, span: 1 },
  { kind: LABO_BLOCK_KIND.Teeth, span: 1 },
  { kind: LABO_BLOCK_KIND.FinishLine, span: 1 },
  { kind: LABO_BLOCK_KIND.Notes, span: 3 },
];

/**
 * A layout saved while Loại phục hình had cards (R-1202) folds them back into
 * its one block, one column wide where the heading stood and shown while any
 * card was — as the server reads such a layout.
 */
export function withoutRestorationCards(blocks: readonly LaboFormBlockDto[]): LaboFormBlockDto[] {
  if (!blocks.some((block) => isCard(block.kind))) return [...blocks];
  const shown = blocks.some((block) => isCard(block.kind) && block.visible);
  return blocks
    .filter((block) => !isCard(block.kind))
    .map((block) => (block.kind === LABO_BLOCK_KIND.Restoration ? { ...block, visible: shown, span: 1 } : block));
}

export const isSystemKind = (kind: LaboBlockKind): kind is LaboSystemBlockKind =>
  kind !== LABO_BLOCK_KIND.Custom && !isCard(kind);

/** The heading shown and printed: the template's own, else the block's name ("Thông tin bổ sung" for a section). */
export function blockTitle(block: Pick<LaboFormBlockDto, "kind" | "title">): string {
  const own = block.title?.trim();
  if (own) return own;
  return isSystemKind(block.kind) ? t(BLOCK_NAME[block.kind]) : t("Labo:Slip:Extra");
}

/** True when the layout hides that part of the slip; a slip with no layout hides nothing. */
export const hidesBlock = (blocks: readonly LaboFormBlockDto[] | undefined, kind: LaboBlockKind): boolean =>
  (blocks ?? []).some((block) => block.kind === kind && !block.visible);

/** True when the layout hides Loại phục hình (R-1216), so none is asked for or sent; cards of an older layout count as its block. */
export const hidesRestorations = (blocks: readonly LaboFormBlockDto[] | undefined): boolean =>
  hidesBlock(withoutRestorationCards(blocks ?? []), LABO_BLOCK_KIND.Restoration);

/** The class giving a block its width on the slip's three-column grid. */
export const spanClass = (span: number): string => `is-span-${Math.min(3, Math.max(1, Math.round(span)))}`;

/**
 * The entries a section holds, in their own order. One naming no section of
 * the layout goes to the first, as the server files it.
 */
export function sectionEntries<T extends { blockKey?: string | null }>(
  blocks: readonly LaboFormBlockDto[],
  entries: readonly T[],
  block: LaboFormBlockDto,
): T[] {
  const sections = blocks.filter((item) => item.kind === LABO_BLOCK_KIND.Custom);
  const known = new Set(sections.map((item) => item.key));
  const first = sections[0]?.key;
  return entries.filter((entry) => {
    const key = entry.blockKey && known.has(entry.blockKey) ? entry.blockKey : first;
    return key === block.key;
  });
}
