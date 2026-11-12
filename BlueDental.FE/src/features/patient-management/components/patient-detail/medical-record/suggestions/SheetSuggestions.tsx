import type { CSSProperties, MouseEvent } from "react";
import { createPortal } from "react-dom";
import { t } from "@/lib/i18n";
import type { Suggestion } from "./matchSuggestions";
import type { OpenSuggestions } from "./useSheetSuggestions";

interface Props {
  open: OpenSuggestions | null;
  onPick: (index: number) => void;
  onHighlight: (index: number) => void;
}

/** A text of several lines is shown on one. */
const oneLine = (text: string) => text.replace(/\n+/g, " · ");

/** What was typed stays plain; the rest of the text — what the choice adds — is bold. */
function SuggestionText({ item }: { item: Suggestion }) {
  const end = item.start + item.length;
  return (
    <>
      {item.start > 0 && <strong>{oneLine(item.text.slice(0, item.start))}</strong>}
      {oneLine(item.text.slice(item.start, end))}
      {end < item.text.length && <strong>{oneLine(item.text.slice(end))}</strong>}
    </>
  );
}

/**
 * The list under the line being written. Pressing an option writes it in
 * before the sheet loses the caret: `mousedown`, with the default held back,
 * so the focus never leaves the blank.
 */
export function SheetSuggestions({ open, onPick, onHighlight }: Props) {
  if (!open) return null;

  const position = {
    "--mr-suggest-left": `${open.anchor.left}px`,
    "--mr-suggest-top": `${open.anchor.top}px`,
    "--mr-suggest-width": `${open.anchor.width}px`,
  } as CSSProperties;

  const handleMouseDown = (index: number) => (event: MouseEvent) => {
    event.preventDefault();
    onPick(index);
  };

  return createPortal(
    <div className="mr-suggest" style={position}>
      <ul className="mr-suggest-list" role="listbox" aria-label={t("Patient:MedicalRecord:Suggestions")}>
        {open.items.map((item, index) => (
          <li
            key={item.text}
            role="option"
            aria-selected={index === open.active}
            className={["mr-suggest-option", index === open.active && "mr-suggest-option--active"]
              .filter(Boolean)
              .join(" ")}
            onMouseDown={handleMouseDown(index)}
            onMouseEnter={() => onHighlight(index)}
          >
            <SuggestionText item={item} />
          </li>
        ))}
      </ul>
      <div className="mr-suggest-hint">{t("Patient:MedicalRecord:SuggestionsHint")}</div>
    </div>,
    document.body,
  );
}
