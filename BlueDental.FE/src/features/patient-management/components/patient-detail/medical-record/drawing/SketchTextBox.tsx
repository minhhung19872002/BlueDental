import type { CSSProperties, KeyboardEvent, RefObject } from "react";
import { t } from "@/lib/i18n";
import { PAGE_PX_PER_POINT, SKETCH_HEIGHT, SKETCH_WIDTH, type SketchSettings } from "./sketch";
import type { TextDraft } from "./useSketchCanvas";

interface Props {
  draft: TextDraft;
  settings: SketchSettings;
  inputRef: RefObject<HTMLTextAreaElement | null>;
  onText: (text: string) => void;
  onCommit: () => void;
  onCancel: () => void;
}

/** "underline line-through", "none" … for CSS's text-decoration-line. */
function decorationOf({ underline, strike }: SketchSettings["text"]): string {
  return [underline && "underline", strike && "line-through"].filter(Boolean).join(" ") || "none";
}

/**
 * The box words are typed into, laid where the page was clicked and drawn in
 * the style they will land in — font, size, bold, alignment — so what is
 * typed is what is drawn.
 *
 * As in Paint, Enter starts a new line and a click elsewhere on the page puts
 * the words down; Ctrl+Enter does too. Esc drops them and leaves the dialog open.
 */
export function SketchTextBox({ draft, settings, inputRef, onText, onCommit, onCancel }: Props) {
  const { text: style } = settings;

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      onCommit();
    } else if (event.key === "Escape") {
      // The dialog closes on Esc too; here it only means "not these words".
      event.preventDefault();
      event.stopPropagation();
      onCancel();
    }
  };

  return (
    <textarea
      ref={inputRef}
      autoFocus
      rows={1}
      value={draft.text}
      className="sketch-text-box"
      aria-label={t("Patient:MedRecord:TextInput")}
      style={
        {
          "--text-x": draft.at.x / SKETCH_WIDTH,
          "--text-y": draft.at.y / SKETCH_HEIGHT,
          "--text-size": style.points * PAGE_PX_PER_POINT,
          "--text-color": settings.color,
          "--text-font": `"${style.font}"`,
          "--text-weight": style.bold ? 700 : 400,
          "--text-slant": style.italic ? "italic" : "normal",
          "--text-deco": decorationOf(style),
          "--text-align": style.align,
        } as CSSProperties
      }
      onChange={(event) => onText(event.target.value)}
      onKeyDown={handleKeyDown}
    />
  );
}
