import { arrayMove } from "@dnd-kit/sortable";
import type { BlockDraft } from "./formTemplateModel";

/**
 * What a drag in the Mẫu phiếu builder carries (R-1202): a whole block, one
 * field of a section, or a section's field list as a drop target — so a field
 * can land in a section that holds none yet, or at the end of one. Row ids are
 * unique across blocks and fields, so they serve as the drag ids as they are.
 */
export type LayoutDragData =
  | { type: "block" }
  | { type: "field"; blockRowId: string }
  | { type: "section"; blockRowId: string };

/** The drop-target id of a section's field list, apart from the block's own id. */
export const sectionDropId = (blockRowId: string): string => `fields-of-${blockRowId}`;

/** A field may land on another field or on a section's list; a block only among blocks. */
export function accepts(
  dragged: LayoutDragData["type"] | undefined,
  target: LayoutDragData["type"] | undefined,
): boolean {
  if (dragged === "block") return target === "block";
  if (dragged === "field") return target === "field" || target === "section";
  return false;
}

/** Puts the block `activeRowId` where `overRowId` stands; an unknown id leaves the layout as it is. */
export function reorderBlocks(blocks: BlockDraft[], activeRowId: string, overRowId: string): BlockDraft[] {
  const from = blocks.findIndex((block) => block.rowId === activeRowId);
  const to = blocks.findIndex((block) => block.rowId === overRowId);
  if (from < 0 || to < 0 || from === to) return blocks;
  return arrayMove(blocks, from, to);
}

/** The section holding the field, if any. */
export const sectionOf = (blocks: BlockDraft[], fieldRowId: string): BlockDraft | undefined =>
  blocks.find((block) => block.fields.some((field) => field.rowId === fieldRowId));

/**
 * Moves the field `fieldRowId` into the section `toBlockRowId`, at `toIndex`
 * (its end when null). Within its own section it is an order change; across
 * sections a move that keeps the field's key, so the answers orders already
 * hold under it still read. A section may be left empty — the builder then
 * says so and Lưu waits, as the server would refuse it (Labo:0060).
 */
export function moveField(
  blocks: BlockDraft[],
  fieldRowId: string,
  toBlockRowId: string,
  toIndex: number | null,
): BlockDraft[] {
  const fromBlock = sectionOf(blocks, fieldRowId);
  const target = blocks.find((block) => block.rowId === toBlockRowId);
  if (!fromBlock || !target) return blocks;
  const from = fromBlock.fields.findIndex((field) => field.rowId === fieldRowId);

  if (fromBlock.rowId === target.rowId) {
    const to = Math.min(toIndex ?? target.fields.length - 1, target.fields.length - 1);
    if (to === from) return blocks;
    const fields = arrayMove(target.fields, from, to);
    return blocks.map((block) => (block.rowId === target.rowId ? { ...block, fields } : block));
  }

  const into = [...target.fields];
  into.splice(Math.min(toIndex ?? into.length, into.length), 0, fromBlock.fields[from]);
  return blocks.map((block) => {
    if (block.rowId === fromBlock.rowId) return { ...block, fields: block.fields.filter((f) => f.rowId !== fieldRowId) };
    if (block.rowId === target.rowId) return { ...block, fields: into };
    return block;
  });
}

/**
 * Where a dragged field lands: the section, and its place there (null for the
 * end). Over another field it takes that field's place, or the one after it
 * when `after` says the drag sits below that field's middle.
 */
export function fieldTarget(
  blocks: BlockDraft[],
  over: { id: string; data: LayoutDragData },
  after: boolean,
): { blockRowId: string; index: number | null } | null {
  const data = over.data;
  if (data.type === "section") return { blockRowId: data.blockRowId, index: null };
  if (data.type !== "field") return null;
  // Read the section from the draft, not the drag data: a move during the drag may have changed it.
  const block = sectionOf(blocks, over.id);
  const index = block?.fields.findIndex((field) => field.rowId === over.id) ?? -1;
  if (!block || index < 0) return null;
  return { blockRowId: block.rowId, index: after ? index + 1 : index };
}
