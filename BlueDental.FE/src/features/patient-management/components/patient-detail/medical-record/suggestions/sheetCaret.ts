import { parseLineKey } from "../lineEditing";

/** Where the caret is on a sheet, and where a list hangs under it. */

const FIELD_ATTR = "data-medical-record-field";
const FLOW_OF = "data-flow-of";
/** Never narrower than this, whatever the blank. */
const MIN_LIST_WIDTH = 280;
/** Below this much room under the line, the list opens above it when there is more room there. */
const MIN_ROOM_BELOW = 220;
/** Kept clear of the window's edge. */
const EDGE = 8;

/**
 * Where the list hangs, in the page's own pixels: under the line being
 * written — or over it, `bottom` set instead of `top`, when the line is near
 * the foot of the window. `room` is the height it may take there.
 */
export interface SuggestAnchor {
  left: number;
  top: number | null;
  bottom: number | null;
  width: number;
  room: number;
}

/** By node type: the sheet is another document, with its own copy of every DOM class. */
function isElement(node: Node): node is Element {
  return node.nodeType === Node.ELEMENT_NODE;
}

/** The blank the caret is in — the blank itself when the caret is on a line it flowed onto. */
export function blankAtCaret(doc: Document): { field: Element; line: Element } | null {
  const node = doc.getSelection()?.anchorNode ?? null;
  const element = node && isElement(node) ? node : (node?.parentElement ?? null);
  const line = element?.closest(`[${FIELD_ATTR}], [${FLOW_OF}]`) ?? null;
  if (!line) return null;
  const continued = line.getAttribute(FLOW_OF);
  const field = continued ? doc.querySelector(`[${FIELD_ATTR}="${CSS.escape(continued)}"]`) : line;
  return field ? { field, line } : null;
}

/**
 * The printed blank whose list `field` offers: itself, or — for a line the
 * clinic added with Enter (`custom.line.<blank>.<n>`) — the blank it grew under.
 */
export function listedBlankOf(field: Element): string {
  const id = field.getAttribute(FIELD_ATTR) ?? "";
  return parseLineKey(id)?.anchor ?? id;
}

/** The sheet's pixels to the page's: the frame is drawn at the zoom picked in the toolbar. */
export function anchorUnder(frame: HTMLIFrameElement, doc: Document, line: Element): SuggestAnchor {
  const box = frame.getBoundingClientRect();
  const scale = box.width / (doc.documentElement.clientWidth || box.width);
  const at = line.getBoundingClientRect();
  const lineTop = box.top + at.top * scale;
  const lineBottom = box.top + at.bottom * scale;
  const below = window.innerHeight - lineBottom - 2 - EDGE;
  const above = lineTop - 2 - EDGE;
  const over = below < MIN_ROOM_BELOW && above > below;
  return {
    left: box.left + at.left * scale,
    top: over ? null : lineBottom + 2,
    bottom: over ? window.innerHeight - lineTop + 2 : null,
    width: Math.max(MIN_LIST_WIDTH, at.width * scale),
    room: Math.max(0, over ? above : below),
  };
}

/** The caret after the last letter of the blank, on whichever line that now is. */
export function caretToEnd(doc: Document, field: Element) {
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
