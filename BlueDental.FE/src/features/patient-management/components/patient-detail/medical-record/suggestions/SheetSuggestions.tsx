import { useEffect, useRef, type CSSProperties, type MouseEvent, type UIEvent } from "react";
import { createPortal } from "react-dom";
import { t } from "@/lib/i18n";
import type { Suggestion } from "./matchSuggestions";
import type { OpenSuggestions } from "./useSheetSuggestions";

interface Props {
  open: OpenSuggestions | null;
  onPick: (index: number) => void;
  onHighlight: (index: number) => void;
  onMore: () => void;
}

/** How close to the end of the list, in pixels, scrolling loads the next page. */
const LOAD_MORE_EDGE = 40;

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

/** Holds the press back, so the focus never leaves the blank — on an option, or on the list's scrollbar. */
function keepFocus(event: MouseEvent) {
  event.preventDefault();
}

/**
 * The list under the line being written. Pressing an option writes it in
 * before the sheet loses the caret: `mousedown`, with the default held back.
 * It shows a page at a time; scrolling to its end loads the next (R-1222).
 */
export function SheetSuggestions({ open, onPick, onHighlight, onMore }: Props) {
  const listRef = useRef<HTMLUListElement>(null);
  const active = open?.active ?? -1;

  // The one chosen with ↑/↓ stays in sight, also when ↓ has just loaded it.
  useEffect(() => {
    if (active < 0) return;
    listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: "nearest" });
  }, [active]);

  if (!open) return null;

  const { anchor } = open;
  const position = {
    "--mr-suggest-left": `${anchor.left}px`,
    "--mr-suggest-top": anchor.top === null ? "auto" : `${anchor.top}px`,
    "--mr-suggest-bottom": anchor.bottom === null ? "auto" : `${anchor.bottom}px`,
    "--mr-suggest-width": `${anchor.width}px`,
    "--mr-suggest-room": `${anchor.room}px`,
  } as CSSProperties;

  const handleScroll = (event: UIEvent<HTMLUListElement>) => {
    const list = event.currentTarget;
    if (open.hasMore && list.scrollTop + list.clientHeight >= list.scrollHeight - LOAD_MORE_EDGE) onMore();
  };

  const handleMouseDown = (index: number) => (event: MouseEvent) => {
    event.preventDefault();
    onPick(index);
  };

  return createPortal(
    <div className="mr-suggest" style={position} onMouseDown={keepFocus}>
      <ul
        ref={listRef}
        className="mr-suggest-list"
        role="listbox"
        aria-label={t("Patient:MedicalRecord:Suggestions")}
        onScroll={handleScroll}
      >
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
