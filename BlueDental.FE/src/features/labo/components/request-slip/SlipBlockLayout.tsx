import type { ReactNode } from "react";
import { LABO_BLOCK_KIND, type LaboFormBlockDto } from "@/features/labo/api/laboFormTemplateApi";
import { ExtraFormSection } from "./ExtraFormSection";
import type { ExtraFormValues } from "./extraFormModel";
import { blockTitle, sectionEntries, spanClass, withRestorationCards } from "./slipLayout";
import { useMasonryRows } from "./useMasonryRows";
import type { SlipParts } from "./useSlipParts";

interface Props {
  parts: SlipParts;
  extra: ExtraFormValues;
  editable: boolean;
  onAnswer: (key: string, values: string[]) => void;
}

/** One system block of the slip under the template's heading. */
function systemBlock(parts: SlipParts, block: LaboFormBlockDto, title: string): ReactNode {
  switch (block.kind) {
    case LABO_BLOCK_KIND.Info:
      return parts.info(title);
    case LABO_BLOCK_KIND.Restoration:
      return parts.restorationHeading(title);
    case LABO_BLOCK_KIND.AllCeramic:
    case LABO_BLOCK_KIND.Alloy:
    case LABO_BLOCK_KIND.OtherOnImplant:
      // A renamed card keeps its name even with no material; a plain one shows its group's.
      return parts.restorationCard(block.kind, block.title?.trim() || undefined, title);
    case LABO_BLOCK_KIND.Shade:
      return parts.shade(title);
    case LABO_BLOCK_KIND.Teeth:
      return parts.teeth(title);
    case LABO_BLOCK_KIND.FinishLine:
      return parts.finishLines(title);
    case LABO_BLOCK_KIND.Notes:
      return parts.notes(title);
    default:
      return null;
  }
}

/**
 * The Phiếu yêu cầu laid out by its Mẫu phiếu (F-94): the template's blocks
 * in its order on a three-column grid, each as wide as the template says,
 * packed without row gaps (R-1202), hidden ones left out, sections holding
 * the template's own fields.
 */
export function SlipBlockLayout({ parts, extra, editable, onAnswer }: Props) {
  const gridRef = useMasonryRows<HTMLDivElement>();
  return (
    <div ref={gridRef} className="rs-blocks rs-masonry">
      {withRestorationCards(extra.blocks)
        .filter((block) => block.visible)
        .map((block, index) => {
          const title = blockTitle(block);
          const key = block.key ?? `system-${block.kind}-${index}`;
          const span = spanClass(block.span);
          if (block.kind === LABO_BLOCK_KIND.Custom)
            return (
              <ExtraFormSection
                key={key}
                title={title}
                fields={sectionEntries(extra.blocks, extra.fields, block)}
                answers={extra.answers}
                editable={editable}
                className={`rs-block ${span}`}
                onAnswer={onAnswer}
              />
            );
          return (
            <div key={key} className={`rs-block ${span}`} data-block-kind={block.kind}>
              {systemBlock(parts, block, title)}
            </div>
          );
        })}
    </div>
  );
}
