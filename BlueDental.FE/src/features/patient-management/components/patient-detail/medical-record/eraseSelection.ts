import { FLOW_BREAK, flowOwner, flowParts, writeFlowed } from "./flowLines";

/**
 * Delete or Backspace over a selection that runs across a sheet's lines
 * (owner, 2026-11-12, R-1221): Ctrl+A in "2. Bệnh chuyên khoa" takes its whole
 * entry (multiLineSelect), and a Delete then has to wipe what is selected —
 * before, it only gave the blanks back and erased nothing.
 *
 * Only writing is erased: the words the form prints itself and its tick boxes
 * stay. Each blank touched is written again whole, so a long one flows anew
 * over its lines, and the caret is left where the selection began.
 */

const TEXT_BLANK = '[data-field-type="text"]';
/** Marks where the caret goes while the blanks are rewritten; not a character anyone types. */
const CARET_MARK = "\uE000";

/** By node type: the sheet is another document, with its own copy of every DOM class. */
function isElement(node: Node): node is Element {
  return node.nodeType === Node.ELEMENT_NODE;
}

function elementOf(node: Node): Element | null {
  return isElement(node) ? node : node.parentElement;
}

/** The part of `blank` inside `range`, removed. */
function cut(range: Range, blank: Element) {
  const part = blank.ownerDocument.createRange();
  part.selectNodeContents(blank);
  if (range.compareBoundaryPoints(Range.START_TO_START, part) > 0) part.setStart(range.startContainer, range.startOffset);
  if (range.compareBoundaryPoints(Range.END_TO_END, part) < 0) part.setEnd(range.endContainer, range.endOffset);
  part.deleteContents();
}

/** A blank's value read back off its lines, leaving out the lines now empty. */
function joined(parts: readonly Element[]): string {
  return parts.reduce((text, part, at) => {
    const own = part.textContent ?? "";
    if (at === 0 || !own) return at === 0 ? own : text;
    if (!text) return own;
    return `${text}${part.getAttribute(FLOW_BREAK) === "hard" ? "\n" : " "}${own}`;
  }, "");
}

/** The caret `offset` characters into the blank's value, on whichever line that falls. */
function placeCaret(field: Element, offset: number) {
  const doc = field.ownerDocument;
  let left = offset;
  const parts = flowParts(field);
  const at = parts.find((part, index) => {
    const length = part.textContent?.length ?? 0;
    if (left <= length || index === parts.length - 1) return true;
    left -= length + 1;
    return false;
  });
  const host = at ?? field;
  const text = host.firstChild;
  const selection = doc.getSelection();
  host.closest<HTMLElement>("[contenteditable]")?.focus({ preventScroll: true });
  if (text && text.nodeType === Node.TEXT_NODE) {
    selection?.collapse(text, Math.min(Math.max(left, 0), text.textContent?.length ?? 0));
  } else {
    selection?.collapse(host, 0);
  }
}

/**
 * Erases what `range` covers in the sheet's text blanks. `release` gives the
 * blanks back their writing first; the blanks touched are then reported as
 * typing, so the sheet collects them.
 */
export function eraseSelection(doc: Document, range: Range, release: () => void) {
  const touched = Array.from(doc.querySelectorAll(TEXT_BLANK)).filter((blank) => range.intersectsNode(blank));
  const owners = [...new Set(touched.map(flowOwner).filter((owner): owner is Element => owner !== null))];
  if (owners.length === 0) {
    release();
    return;
  }

  touched.forEach((blank) => cut(range, blank));
  const start = elementOf(range.startContainer)?.closest(TEXT_BLANK);
  if (start) range.insertNode(doc.createTextNode(CARET_MARK));

  release();
  let caret: { field: Element; offset: number } | null = null;
  for (const owner of owners) {
    const text = joined(flowParts(owner));
    const mark = text.indexOf(CARET_MARK);
    if (mark >= 0 && !caret) caret = { field: owner, offset: mark };
    writeFlowed(owner, text.replace(CARET_MARK, ""));
  }

  const first = owners[0];
  placeCaret(caret?.field ?? first, caret?.offset ?? 0);
  const InputEvent = doc.defaultView?.Event ?? Event;
  owners.forEach((owner) => owner.dispatchEvent(new InputEvent("input", { bubbles: true })));
}
