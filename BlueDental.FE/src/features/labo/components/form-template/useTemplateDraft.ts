import { useCallback, useEffect, useState } from "react";
import { LABO_BLOCK_KIND, type LaboFormTemplateDto } from "../../api/laboFormTemplateApi";
import {
  blankSection,
  moveItem,
  templateDraft,
  type BlockDraft,
  type TemplateDraft,
} from "./formTemplateModel";

/**
 * The builder's draft (F-94): the head fields and the layout, block by block.
 * Reloaded from the template each time the dialog opens.
 */
export function useTemplateDraft(open: boolean, template: LaboFormTemplateDto | null) {
  const [draft, setDraft] = useState<TemplateDraft>(() => templateDraft(null));

  useEffect(() => {
    if (open) setDraft(templateDraft(template));
  }, [open, template]);

  const patch = useCallback(
    (next: Partial<Omit<TemplateDraft, "blocks">>) => setDraft((current) => ({ ...current, ...next })),
    [],
  );

  const setBlocks = useCallback(
    (change: (blocks: BlockDraft[]) => BlockDraft[]) =>
      setDraft((current) => ({ ...current, blocks: change(current.blocks) })),
    [],
  );

  const updateBlock = useCallback(
    (next: BlockDraft) => setBlocks((blocks) => blocks.map((b) => (b.rowId === next.rowId ? next : b))),
    [setBlocks],
  );

  const moveBlock = useCallback(
    (index: number, step: -1 | 1) => setBlocks((blocks) => moveItem(blocks, index, step)),
    [setBlocks],
  );

  const removeBlock = useCallback(
    (rowId: string) => setBlocks((blocks) => blocks.filter((b) => b.rowId !== rowId)),
    [setBlocks],
  );

  /** A new section goes last — before Yêu cầu when that block closes the layout. */
  const addSection = useCallback(
    () =>
      setBlocks((blocks) => {
        const notesLast = blocks.at(-1)?.kind === LABO_BLOCK_KIND.Notes;
        const next = [...blocks];
        next.splice(notesLast ? next.length - 1 : next.length, 0, blankSection());
        return next;
      }),
    [setBlocks],
  );

  return { draft, patch, updateBlock, moveBlock, removeBlock, addSection };
}
