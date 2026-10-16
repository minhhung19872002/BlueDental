import { useRef, type CSSProperties, type Ref } from "react";
import { t } from "@/lib/i18n";
import { SKETCH_HEIGHT, SKETCH_WIDTH } from "./sketch";
import type { RunLook } from "./richText";
import { useRichText, type RichTextHandle } from "./useRichText";
import { useTextBoxDrag, type BoxGrip, type TextBoxFrame } from "./useTextBoxDrag";
import type { TextDraft } from "./useSketchCanvas";

const EDGES = ["n", "s", "e", "w"] as const;
const HANDLES: readonly BoxGrip[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];

interface Props {
  draft: TextDraft;
  /** What an empty box types in: the text bar's style and the colour in use. */
  look: RunLook;
  editorRef: Ref<RichTextHandle>;
  onFrame: (frame: TextBoxFrame) => void;
  onLook: (look: RunLook) => void;
  onCommit: () => void;
  onCancel: () => void;
}

/**
 * Paint's text box, laid on the page where it was opened: a dashed frame with
 * eight handles that size it, an edge that moves it, and the words inside
 * wrapping at its width — each stretch in its own style, drawn as it will land.
 *
 * A click elsewhere on the page puts the words down, as does Ctrl+Enter; Esc
 * drops them and leaves the dialog open.
 */
export function SketchTextBox({ draft, look, editorRef, onFrame, onLook, onCommit, onCancel }: Props) {
  const frame = useRef<HTMLDivElement>(null);
  const editor = useRef<HTMLDivElement>(null);
  const { handleKeyDown } = useRichText(editor, { runs: draft.runs, look, handle: editorRef, onLook, onCommit, onCancel });
  const grip = useTextBoxDrag(frame, draft, onFrame);

  return (
    <div
      ref={frame}
      className="sketch-text-frame"
      style={
        {
          "--text-x": draft.at.x / SKETCH_WIDTH,
          "--text-y": draft.at.y / SKETCH_HEIGHT,
          "--text-w": draft.width,
          "--text-h": draft.height,
          "--text-align": draft.align,
        } as CSSProperties
      }
    >
      {EDGES.map((edge) => (
        <span key={edge} className={`sketch-text-edge sketch-text-edge--${edge}`} aria-hidden="true" {...grip("move")} />
      ))}
      <div
        ref={editor}
        className="sketch-text-editor"
        contentEditable
        suppressContentEditableWarning
        spellCheck={false}
        role="textbox"
        aria-multiline="true"
        aria-label={t("Patient:MedRecord:TextInput")}
        onKeyDown={handleKeyDown}
      />
      {HANDLES.map((handle) => (
        <span
          key={handle}
          className={`sketch-text-handle sketch-text-handle--${handle}`}
          data-grip={handle}
          aria-hidden="true"
          {...grip(handle)}
        />
      ))}
    </div>
  );
}
