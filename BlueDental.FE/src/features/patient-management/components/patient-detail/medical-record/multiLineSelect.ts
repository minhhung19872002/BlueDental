import { eraseSelection } from "./eraseSelection";
import { flowOwner, flowParts } from "./flowLines";
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
 *   - Ctrl+A selects the blank the caret is in, and nothing else (owner,
 *     2026-11-13, R-1223 — it used to take the label's whole entry, every line
 *     under it too): one that fits its line is left to the browser, which
 *     keeps it to that blank; one whose text flowed onto lines of its own is
 *     selected over them, held;
 *   - Delete or Backspace erases what is selected (owner, 2026-11-12, R-1221 —
 *     before, it was spent on giving the blanks back and wiped nothing; see
 *     eraseSelection), and that is reported as an edit;
 *   - a letter typed over it erases it too and is written in its place
 *     (R-1223 — it used to be spent on giving the blanks back, so the first
 *     letter of a word went missing: "dòng" came out "òng");
 *   - the next click, or any other key but Ctrl+C, gives the blanks back. The
 *     key itself is spent on that.
 *
 * Selecting writes nothing, so it is not reported as an edit.
 */

const EDITABLE = '[contenteditable="true"]';
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

/** Text typed over a selection: one character, no command key. */
function isTyping(event: KeyboardEvent): boolean {
  return event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey;
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

  /** Ctrl+A over a blank whose text flowed onto lines of its own: all of them, as one. */
  const selectBlank = (event: KeyboardEvent) => {
    const host = hostOf(event.target as Node | null);
    const owner = host ? flowOwner(host) : null;
    if (!owner) return;
    const parts = flowParts(owner);
    const first = parts[0];
    const last = parts[parts.length - 1];
    if (first === last) return;
    event.preventDefault();
    hold();
    doc.getSelection()?.setBaseAndExtent(first, 0, last, last.childNodes.length);
  };

  const onKeyDown = (event: KeyboardEvent) => {
    const command = event.ctrlKey || event.metaKey;
    const key = event.key.toLowerCase();
    if (!holding) {
      if (command && key === "a" && !event.isComposing) selectBlank(event);
      return;
    }
    if (MODIFIER_KEYS.has(event.key) || (command && key === "c")) return;
    const selection = doc.getSelection();
    const selected = selection && selection.rangeCount > 0 && !selection.isCollapsed ? selection.getRangeAt(0) : null;
    // A letter over the selection: erased, then the key goes on to write where the caret was left.
    if (selected && isTyping(event) && !event.isComposing) {
      event.stopPropagation();
      eraseSelection(doc, selected, release);
      return;
    }
    // Not passed on: Enter, or lineEditing's Delete on an empty line, must not act on blanks the selection spans.
    event.preventDefault();
    event.stopPropagation();
    const erase = (event.key === "Delete" || event.key === "Backspace") && !command;
    if (erase && selected) {
      eraseSelection(doc, selected, release);
      return;
    }
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
