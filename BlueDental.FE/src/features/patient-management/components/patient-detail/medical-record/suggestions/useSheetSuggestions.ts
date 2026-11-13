import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { useMedicalRecordFieldSuggestions } from "../../../../api/medicalRecordApi";
import { flowedText, writeFlowed } from "../flowLines";
import { matchSuggestions, type Suggestion } from "./matchSuggestions";
import { anchorUnder, blankAtCaret, caretToEnd, listedBlankOf, type SuggestAnchor } from "./sheetCaret";

/** How many the list shows at first, and how many more each time it is scrolled to its end (R-1222). */
export const SUGGESTION_PAGE = 10;

export interface OpenSuggestions {
  /** The ones loaded so far. */
  items: Suggestion[];
  /** Whether scrolling on loads more. */
  hasMore: boolean;
  /** The one Tab writes in: the first, until ↑/↓ or the pointer picks another. */
  active: number;
  anchor: SuggestAnchor;
}

interface Target {
  field: Element;
  matches: Suggestion[];
  shown: number;
  active: number;
  /**
   * Whether `active` was picked with ↑/↓ or the pointer. Only then does Enter
   * write it in; until then Enter keeps its meaning — the next line — so a
   * line typed in full is never swapped for a longer one.
   */
  chosen: boolean;
  anchor: SuggestAnchor;
}

/**
 * "Gợi ý khi nhập" on a sheet (R-1219): typing in a blank that offers
 * suggestions lists what the branch wrote on that part of the form before,
 * from the first letter; Ctrl + Space lists them in an empty blank too
 * (R-1220). Every printed line of the part offers the same list, and so does a
 * line added under it with Enter (R-1222). As in a browser's address bar, the
 * first match stands ready and Tab writes it in (R-1229); ↑/↓ choose another,
 * then Enter or Tab or a click writes the choice in, Esc closes; a long list
 * loads on as it is scrolled.
 * The list lives on the page, not in the sheet's own document — printing
 * copies that document, and the list must never reach paper.
 */
export function useSheetSuggestions(
  frame: RefObject<HTMLIFrameElement | null>,
  form: number | undefined,
  editable: boolean,
) {
  const query = useMedicalRecordFieldSuggestions(form, editable);
  const lists = useMemo(
    () => new Map((query.data ?? []).flatMap((item) =>
      (item.fields?.length ? item.fields : [item.field]).map((id) => [id, item.values] as const))),
    [query.data],
  );
  const listsRef = useRef(lists);
  listsRef.current = lists;

  const [target, setTarget] = useState<Target | null>(null);
  const targetRef = useRef(target);
  targetRef.current = target;

  /** Set while a choice is written in, so the input it reports does not open the list again. */
  const picking = useRef(false);

  const close = useCallback(() => setTarget(null), []);

  const pick = useCallback((index: number) => {
    const open = targetRef.current;
    const doc = frame.current?.contentDocument;
    const chosen = open?.matches[index];
    if (!open || !doc || !chosen) return;
    setTarget(null);
    writeFlowed(open.field, chosen.text);
    caretToEnd(doc, open.field);
    // Reported like typing, so the sheet collects it; the list stays shut for it.
    targetRef.current = null;
    picking.current = true;
    open.field.dispatchEvent(new (doc.defaultView ?? window).Event("input", { bubbles: true }));
    picking.current = false;
  }, [frame]);

  const highlight = useCallback((index: number) => {
    setTarget((open) => (open ? { ...open, active: index, chosen: true } : open));
  }, []);

  const more = useCallback(() => {
    setTarget((open) =>
      open && open.shown < open.matches.length ? { ...open, shown: open.shown + SUGGESTION_PAGE } : open);
  }, []);

  /** ↓ past the last one loaded loads the next page; past the very last goes back to the top. */
  const step = useCallback((by: 1 | -1) => {
    setTarget((open) => {
      if (!open) return open;
      const next = open.active + by;
      if (next < 0) return { ...open, active: open.shown - 1, chosen: true };
      if (next >= open.matches.length) return { ...open, active: 0, chosen: true };
      const shown = next >= open.shown ? open.shown + SUGGESTION_PAGE : open.shown;
      return { ...open, active: next, shown, chosen: true };
    });
  }, []);

  const attach = useCallback((doc: Document) => {
    /** `asked`: Ctrl + Space — an empty blank lists its most used texts too. */
    const refresh = (asked = false) => {
      const iframe = frame.current;
      const at = blankAtCaret(doc);
      const values = at ? listsRef.current.get(listedBlankOf(at.field)) : undefined;
      const matches = at && values ? matchSuggestions(flowedText(at.field), values, { whenEmpty: asked }) : [];
      if (!at || !iframe || matches.length === 0) {
        setTarget(null);
        return;
      }
      setTarget({
        field: at.field,
        matches,
        shown: SUGGESTION_PAGE,
        active: 0,
        chosen: false,
        anchor: anchorUnder(iframe, doc, at.line),
      });
    };

    const onInput = () => {
      if (!picking.current) refresh();
    };

    // Capture, on the document: ahead of Enter moving to the next line (lineEditing).
    const onKeyDown = (event: KeyboardEvent) => {
      const take = () => {
        event.preventDefault();
        event.stopImmediatePropagation();
      };
      // Ctrl + Space asks for the list, typed or not — and never types a space.
      if (event.ctrlKey && (event.code === "Space" || event.key === " ")) {
        if (!blankAtCaret(doc)) return;
        take();
        refresh(true);
        return;
      }

      const open = targetRef.current;
      if (!open) return;

      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        take();
        step(event.key === "ArrowDown" ? 1 : -1);
      } else if (event.key === "Escape") {
        take();
        setTarget(null);
      } else if (event.key === "Tab" || (event.key === "Enter" && open.chosen)) {
        take();
        pick(open.active);
      } else if (event.key === "Enter") {
        setTarget(null);
      }
    };

    doc.addEventListener("input", onInput);
    doc.addEventListener("keydown", onKeyDown, true);
    doc.addEventListener("mousedown", close);
    doc.addEventListener("focusout", close);
    return () => {
      doc.removeEventListener("input", onInput);
      doc.removeEventListener("keydown", onKeyDown, true);
      doc.removeEventListener("mousedown", close);
      doc.removeEventListener("focusout", close);
    };
  }, [frame, close, step, pick]);

  // The list is pinned to the screen; once the page moves under it, it no longer points at the line.
  // Scrolling the list itself is not the page moving.
  useEffect(() => {
    if (!target) return;
    const onScroll = (event: Event) => {
      if (event.target instanceof Element && event.target.closest(".mr-suggest")) return;
      close();
    };
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", close);
    };
  }, [target, close]);

  const open: OpenSuggestions | null = target
    ? {
        items: target.matches.slice(0, target.shown),
        hasMore: target.shown < target.matches.length,
        active: target.active,
        anchor: target.anchor,
      }
    : null;
  return { open, attach, pick, highlight, more };
}
