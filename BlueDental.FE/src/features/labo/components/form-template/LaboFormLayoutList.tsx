import type { Ref } from "react";
import { Button } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { DndContext } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { t } from "@/lib/i18n";
import { LaboFormBlockRow } from "./LaboFormBlockRow";
import { SortableShell } from "./SortableShell";
import { MAX_FIELDS, MAX_SECTIONS, blockLabel, isSection, type BlockDraft } from "./formTemplateModel";
import { useLayoutDnd } from "./useLayoutDnd";
import type { useTemplateDraft } from "./useTemplateDraft";

type DraftEditor = Pick<
  ReturnType<typeof useTemplateDraft>,
  "setBlocks" | "updateBlock" | "moveBlock" | "removeBlock" | "addSection"
>;

interface Props {
  blocks: BlockDraft[];
  editor: DraftEditor;
  /** The scrolling list, so the preview can bring a block's card into view. */
  listRef: Ref<HTMLDivElement>;
}

/** The number of each block's first field, counting the fields of the blocks before it. */
const firstNumbers = (blocks: BlockDraft[]): number[] =>
  blocks.reduce<number[]>(
    (acc, _block, index) => [...acc, index === 0 ? 1 : acc[index - 1] + blocks[index - 1].fields.length],
    [],
  );

/**
 * The layout being built, one card per block (F-94). Cards are dragged by
 * their grip and fields by theirs, across sections too (R-1202); the arrows
 * stay for one-place moves. "Thêm mục" adds a section under the list.
 */
export function LaboFormLayoutList({ blocks, editor, listRef }: Props) {
  const dnd = useLayoutDnd(editor.setBlocks);
  const numbers = firstNumbers(blocks);
  const fieldCount = blocks.reduce((sum, block) => sum + block.fields.length, 0);
  const sectionCount = blocks.filter(isSection).length;

  return (
    <>
      <div className="ft-fields" ref={listRef}>
        <DndContext
          sensors={dnd.sensors}
          autoScroll={dnd.autoScroll}
          collisionDetection={dnd.collisionDetection}
          onDragOver={dnd.onDragOver}
          onDragEnd={dnd.onDragEnd}
        >
          <SortableContext items={blocks.map((block) => block.rowId)} strategy={verticalListSortingStrategy}>
            {blocks.map((block, index) => (
              <SortableShell
                key={block.rowId}
                id={block.rowId}
                data={{ type: "block" }}
                variant="block"
                handleLabel={t("Labo:FormTpl:BlockDragOf", blockLabel(block, index))}
              >
                <LaboFormBlockRow
                  block={block}
                  index={index}
                  count={blocks.length}
                  fieldSlot={{ firstNumber: numbers[index], canAdd: fieldCount < MAX_FIELDS }}
                  onChange={editor.updateBlock}
                  onMove={(step) => editor.moveBlock(index, step)}
                  onRemove={() => editor.removeBlock(block.rowId)}
                />
              </SortableShell>
            ))}
          </SortableContext>
        </DndContext>
      </div>
      <Button
        className="ft-add-section"
        icon={<PlusOutlined />}
        disabled={sectionCount >= MAX_SECTIONS}
        onClick={editor.addSection}
      >
        {t("Labo:FormTpl:AddSection")}
      </Button>
    </>
  );
}
