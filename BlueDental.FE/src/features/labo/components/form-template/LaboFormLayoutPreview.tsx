import type { CSSProperties } from "react";
import { DndContext } from "@dnd-kit/core";
import { SortableContext, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { t } from "@/lib/i18n";
import { blockTitle, spanClass } from "../request-slip/slipLayout";
import { useMasonryRows } from "../request-slip/useMasonryRows";
import type { BlockDraft } from "./formTemplateModel";
import { PreviewBlockBody } from "./PreviewBlockBody";
import { usePreviewDnd } from "./useLayoutDnd";
import type { PreviewCatalog } from "./usePreviewCatalog";
import "../request-slip/request-slip.css";

interface Props {
  blocks: BlockDraft[];
  /** The branch lists the slip parts are drawn from. */
  catalog: PreviewCatalog;
  onReorder: (activeRowId: string, overRowId: string) => void;
  /** A click on a block: bring its card in the builder into view. */
  onPick: (rowId: string) => void;
}

/** Nothing slides aside while a block is dragged: blocks of three widths would jump; the target is outlined instead. */
const stayPut = () => null;

interface BlockProps {
  block: BlockDraft;
  catalog: PreviewCatalog;
  onPick: (rowId: string) => void;
}

function PreviewBlock({ block, catalog, onPick }: BlockProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging, isOver } = useSortable({ id: block.rowId });
  const style = { "--ft-drag-transform": CSS.Translate.toString(transform) ?? "none" } as CSSProperties;
  const title = blockTitle(block);
  const className = [
    "ftp-block",
    spanClass(block.span),
    isDragging && "is-dragging",
    isOver && !isDragging && "is-over",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <section
      ref={setNodeRef}
      className={className}
      style={style}
      aria-label={title}
      data-testid="form-preview-block"
      {...attributes}
      {...listeners}
      onClick={() => onPick(block.rowId)}
    >
      {/* Drawn small, and inert: a click goes to the block, not to the slip parts inside. */}
      <div className="ftp-zoom" inert>
        <PreviewBlockBody block={block} catalog={catalog} />
      </div>
    </section>
  );
}

/**
 * Xem trước (R-1202): the Phiếu yêu cầu as the template lays it out — its
 * shown blocks in order, each as wide as set on the slip's three-column grid.
 * A block dragged here moves in the builder too; the hidden ones are named
 * underneath.
 */
export function LaboFormLayoutPreview({ blocks, catalog, onReorder, onPick }: Props) {
  const dnd = usePreviewDnd(onReorder);
  const sheetRef = useMasonryRows<HTMLDivElement>();
  const shown = blocks.filter((block) => block.visible);
  const hidden = blocks.filter((block) => !block.visible).map((block) => blockTitle(block));

  return (
    <aside className="ftp" aria-label={t("Labo:FormTpl:Preview")}>
      <div className="ftp-head">
        <span className="ftp-head-title">{t("Labo:FormTpl:Preview")}</span>
        <span className="ft-hint">{t("Labo:FormTpl:PreviewHint")}</span>
      </div>
      <DndContext sensors={dnd.sensors} autoScroll={dnd.autoScroll} collisionDetection={dnd.collisionDetection} onDragEnd={dnd.onDragEnd}>
        <SortableContext items={shown.map((block) => block.rowId)} strategy={stayPut}>
          <div ref={sheetRef} className="ftp-sheet rs-slip rs-masonry">
            {shown.map((block) => (
              <PreviewBlock key={block.rowId} block={block} catalog={catalog} onPick={onPick} />
            ))}
          </div>
        </SortableContext>
      </DndContext>
      {hidden.length > 0 && (
        <p className="ftp-hidden" role="note">
          {t("Labo:FormTpl:PreviewHidden", hidden.join(", "))}
        </p>
      )}
    </aside>
  );
}
