import { holdBlanks, releaseBlanks } from "./heldBlanks";
import { copiedText } from "./sheetCopy";

/**
 * Selecting what is written on a sheet across its lines (clinic, 2026-11-09,
 * R-1179): "Tóm tắt bệnh án" written over four lines could only be copied a
 * line at a time.
 *
 * Every line of a sheet is a blank of its own, and so is every line a long
 * blank flowed onto (flowLines) or Enter added (lineEditing). A browser keeps
 * a selection that starts in an editable inside it, so a drag or Ctrl+A only
 * ever took one line. Now, for as long as a selection runs across lines, the
 * blanks are held still (heldBlanks) and the selection is an ordinary one over
 * the page, for Ctrl+C or the context menu's Copy:
 *
 *   - a drag that leaves the blank it started in selects up to the pointer;
 *   - Ctrl+A in a blank selects its whole entry: the label's blank and every
 *     line under it that holds only writing, down to the next label;
 *   - the next click, or any key but Ctrl+C, gives the blanks back. The key
 *     itself is spent on that, so a Delete never wipes lines it cannot see.
 *
 * Nothing written changes, so nothing is reported as an edit.
 */

const EDITABLE = '[contenteditable="true"]';
const BLOCK_SELECTOR = "p, h1, h2, h3, h4, li";
const MODIFIER_KEYS = new Set(["Control", "Meta", "Shift", "Alt", "AltGraph", "CapsLock"]);

interface Point {
  node: Node;
  offset: number;
}

interface Drag {
  from: Point;
  host: Element | null;
}

function elementOf(node: Node | null): Element | null {
  if (!node) return null;
  return node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement;
}

function hostOf(node: Node | null): HTMLElement | null {
  return elementOf(node)?.closest<HTMLElement>(EDITABLE) ?? null;
}

/** The caret position under the pointer; Firefox and Chrome name it differently. */
function pointAt(doc: Document, x: number, y: number): Point | null {
  if (typeof doc.caretPositionFromPoint === "function") {
    const position = doc.caretPositionFromPoint(x, y);
    return position ? { node: position.offsetNode, offset: position.offset } : null;
  }
  const range = doc.caretRangeFromPoint(x, y);
  return range ? { node: range.startContainer, offset: range.startOffset } : null;
}

function blanksIn(block: Element): Element[] {
  return Array.from(block.querySelectorAll(EDITABLE));
}

/** The words a block prints itself, leaving out what is written in its blanks. */
function printedText(block: Element, after: Element | null = null): string {
  const range = block.ownerDocument.createRange();
  range.selectNodeContents(block);
  if (after) range.setStartAfter(after);
  const fragment = range.cloneContents();
  fragment.querySelectorAll(EDITABLE).forEach((blank) => blank.remove());
  return fragment.textContent ?? "";
}

/** A line of writing only — a flowed line, an added one, or a printed blank line under a label. */
function isWritingLine(block: Element | null): block is Element {
  if (!block?.matches(BLOCK_SELECTOR)) return false;
  return blanksIn(block).length > 0 && !printedText(block).trim();
}

/** The block's last blank, if nothing printed follows it: the one a label's writing starts in. */
function trailingBlank(block: Element | null): Element | null {
  if (!block?.matches(BLOCK_SELECTOR)) return null;
  const last = blanksIn(block).at(-1) ?? null;
  return last && !printedText(block, last).trim() ? last : null;
}

/** The first and last blank of the entry `host` is written in. */
function entryOf(host: Element): [Element, Element] {
  const block = host.closest(BLOCK_SELECTOR);
  if (!block) return [host, host];
  const writing = isWritingLine(block);
  // "Họ tên" with "Ngày sinh" after it on its line is an entry of its own.
  if (!writing && trailingBlank(block) !== host) return [host, host];

  let top = block;
  while (writing && isWritingLine(top.previousElementSibling)) top = top.previousElementSibling;
  let bottom = block;
  while (isWritingLine(bottom.nextElementSibling)) bottom = bottom.nextElementSibling;

  const first = writing ? (trailingBlank(top.previousElementSibling) ?? blanksIn(top)[0]) : host;
  return [first, blanksIn(bottom).at(-1) ?? host];
}

export function attachMultiLineSelect(doc: Document): () => void {
  let drag: Drag | null = null;
  let holding = false;

  const hold = () => {
    if (holding) return;
    holdBlanks(doc);
    holding = true;
  };

  const release = () => {
    if (!holding) return;
    releaseBlanks(doc);
    holding = false;
  };

  /** Lets go and leaves the caret where the selection ended. */
  const releaseToCaret = () => {
    const selection = doc.getSelection();
    const end = selection?.focusNode ? { node: selection.focusNode, offset: selection.focusOffset } : null;
    release();
    if (!selection || !end) return;
    hostOf(end.node)?.focus({ preventScroll: true });
    selection.collapse(end.node, end.offset);
  };

  const onMouseDown = (event: MouseEvent) => {
    // A right click keeps the selection, for the context menu's Copy.
    if (event.button !== 0) return;
    release();
    const from = pointAt(doc, event.clientX, event.clientY);
    drag = from ? { from, host: hostOf(event.target as Node | null) } : null;
  };

  const onMouseMove = (event: MouseEvent) => {
    if (!drag || (event.buttons & 1) === 0) return;
    const to = pointAt(doc, event.clientX, event.clientY);
    if (!to) return;
    // Within the blank it started in, the browser's own selection does.
    if (!holding && drag.host && hostOf(to.node) === drag.host) return;
    hold();
    // Ours from here on: the browser's would stop at the blank's edge.
    event.preventDefault();
    doc.getSelection()?.setBaseAndExtent(drag.from.node, drag.from.offset, to.node, to.offset);
  };

  const onMouseUp = () => {
    drag = null;
    if (holding && doc.getSelection()?.isCollapsed) releaseToCaret();
  };

  const selectEntry = (event: KeyboardEvent) => {
    const host = hostOf(event.target as Node | null);
    if (!host) return;
    const [first, last] = entryOf(host);
    if (first === last) return;
    event.preventDefault();
    hold();
    doc.getSelection()?.setBaseAndExtent(first, 0, last, last.childNodes.length);
  };

  const onKeyDown = (event: KeyboardEvent) => {
    const command = event.ctrlKey || event.metaKey;
    const key = event.key.toLowerCase();
    if (!holding) {
      if (command && key === "a" && !event.isComposing) selectEntry(event);
      return;
    }
    if (MODIFIER_KEYS.has(event.key) || (command && key === "c")) return;
    // Not passed on: Enter or Delete must not act on blanks the selection spans.
    event.preventDefault();
    event.stopPropagation();
    releaseToCaret();
  };

  const onCopy = (event: ClipboardEvent) => {
    const selection = doc.getSelection();
    if (!selection || selection.isCollapsed || selection.rangeCount === 0 || !event.clipboardData) return;
    event.clipboardData.setData("text/plain", copiedText(selection.getRangeAt(0)));
    event.preventDefault();
  };

  doc.addEventListener("mousedown", onMouseDown, true);
  doc.addEventListener("mousemove", onMouseMove, true);
  doc.addEventListener("mouseup", onMouseUp, true);
  // Before lineEditing's own, which reads Enter and Delete on the blank.
  doc.addEventListener("keydown", onKeyDown, true);
  doc.addEventListener("copy", onCopy);

  return () => {
    doc.removeEventListener("mousedown", onMouseDown, true);
    doc.removeEventListener("mousemove", onMouseMove, true);
    doc.removeEventListener("mouseup", onMouseUp, true);
    doc.removeEventListener("keydown", onKeyDown, true);
    doc.removeEventListener("copy", onCopy);
    release();
  };
}
