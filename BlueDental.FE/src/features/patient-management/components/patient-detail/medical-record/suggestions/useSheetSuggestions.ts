import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { useMedicalRecordFieldSuggestions } from "../../../../api/medicalRecordApi";
import { flowedText, writeFlowed } from "../flowLines";
import { matchSuggestions, type Suggestion } from "./matchSuggestions";

const FIELD_ATTR = "data-medical-record-field";
const FLOW_OF = "data-flow-of";
/** Never narrower than this, whatever the blank. */
const MIN_LIST_WIDTH = 280;

/** Where the list hangs, in the page's own pixels: under the line being written. */
export interface SuggestAnchor {
  left: number;
  top: number;
  width: number;
}

export interface OpenSuggestions {
  items: Suggestion[];
  /** -1 until ↑/↓ or the pointer picks one: Enter then keeps its usual meaning. */
  active: number;
  anchor: SuggestAnchor;
}

interface Target extends OpenSuggestions {
  field: Element;
}

/** By node type: the sheet is another document, with its own copy of every DOM class. */
function isElement(node: Node): node is Element {
  return node.nodeType === Node.ELEMENT_NODE;
}

/** The blank the caret is in — the blank itself when the caret is on a line it flowed onto. */
function blankAtCaret(doc: Document): { field: Element; line: Element } | null {
  const node = doc.getSelection()?.anchorNode ?? null;
  const element = node && isElement(node) ? node : (node?.parentElement ?? null);
  const line = element?.closest(`[${FIELD_ATTR}], [${FLOW_OF}]`) ?? null;
  if (!line) return null;
  const continued = line.getAttribute(FLOW_OF);
  const field = continued ? doc.querySelector(`[${FIELD_ATTR}="${CSS.escape(continued)}"]`) : line;
  return field ? { field, line } : null;
}

/** The sheet's pixels to the page's: the frame is drawn at the zoom picked in the toolbar. */
function anchorUnder(frame: HTMLIFrameElement, doc: Document, line: Element): SuggestAnchor {
  const box = frame.getBoundingClientRect();
  const scale = box.width / (doc.documentElement.clientWidth || box.width);
  const at = line.getBoundingClientRect();
  return {
    left: box.left + at.left * scale,
    top: box.top + at.bottom * scale + 2,
    width: Math.max(MIN_LIST_WIDTH, at.width * scale),
  };
}

/** The caret after the last letter of the blank, on whichever line that now is. */
function caretToEnd(doc: Document, field: Element) {
  const id = field.getAttribute(FIELD_ATTR) ?? "";
  const lines = doc.querySelectorAll(`[${FLOW_OF}="${CSS.escape(id)}"]`);
  const last = lines.length > 0 ? lines[lines.length - 1] : field;
  const range = doc.createRange();
  range.selectNodeContents(last);
  range.collapse(false);
  const selection = doc.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}

/**
 * "Gợi ý khi nhập" on a sheet (R-1219): typing in a blank that offers
 * suggestions lists what the branch wrote there before, from the first letter;
 * Ctrl + Space lists them in an empty blank too (R-1220); ↑/↓ choose, Enter or
 * Tab or a click writes the choice in, Esc closes. The list lives on the page,
 * not in the sheet's own document — printing copies that document, and the
 * list must never reach paper.
 */
export function useSheetSuggestions(
  frame: RefObject<HTMLIFrameElement | null>,
  form: number | undefined,
  editable: boolean,
) {
  const query = useMedicalRecordFieldSuggestions(form, editable);
  const lists = useMemo(
    () => new Map((query.data ?? []).map((item) => [item.field, item.values] as const)),
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
    const chosen = open?.items[index];
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
    setTarget((open) => (open ? { ...open, active: index } : open));
  }, []);

  const attach = useCallback((doc: Document) => {
    /** `asked`: Ctrl + Space — an empty blank lists its most used texts too. */
    const refresh = (asked = false) => {
      const iframe = frame.current;
      const at = blankAtCaret(doc);
      const values = at ? listsRef.current.get(at.field.getAttribute(FIELD_ATTR) ?? "") : undefined;
      const items = at && values ? matchSuggestions(flowedText(at.field), values, { whenEmpty: asked }) : [];
      if (!at || !iframe || items.length === 0) {
        setTarget(null);
        return;
      }
      setTarget({ field: at.field, items, active: -1, anchor: anchorUnder(iframe, doc, at.line) });
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
      const count = open.items.length;

      if (event.key === "ArrowDown") {
        take();
        highlight((open.active + 1) % count);
      } else if (event.key === "ArrowUp") {
        take();
        highlight(open.active <= 0 ? count - 1 : open.active - 1);
      } else if (event.key === "Escape") {
        take();
        setTarget(null);
      } else if ((event.key === "Enter" || event.key === "Tab") && open.active >= 0) {
        take();
        pick(open.active);
      } else if (event.key === "Enter" || event.key === "Tab") {
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
  }, [frame, close, highlight, pick]);

  // The list is pinned to the screen; once the page moves under it, it no longer points at the line.
  useEffect(() => {
    if (!target) return;
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [target, close]);

  const open: OpenSuggestions | null = target
    ? { items: target.items, active: target.active, anchor: target.anchor }
    : null;
  return { open, attach, pick, highlight };
}
