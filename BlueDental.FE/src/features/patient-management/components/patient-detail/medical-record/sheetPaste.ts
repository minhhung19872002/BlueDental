import { offsetInFlowed, placeCaretAt } from "./flowCaret";
import { FLOW_LINE_ATTR, flowOwner, flowedText, lineEnd, writeFlowed } from "./flowLines";
import { isEditableBlank } from "./heldBlanks";
import { addLineAfter, renumberLines } from "./lineEditing";
import { FIELD_SELECTOR, GENERATED_ROW_ATTR } from "./rowEditing";
import type { SheetHistory } from "./sheetHistory";

/**
 * Pasting several lines into a sheet (clinic, 2026-11-21, R-1263: "copy đc
 * nhiều dòng rồi nhưng paste lại vào hết 1 ô, muốn paste cho ra từng dòng như
 * cũ"). Since lines can be copied across (R-1179), a paste of them went whole
 * into the one blank the caret was in.
 *
 * Now each line of what is pasted goes on a line of its own (owner, option A):
 *
 *   - the first joins the blank the caret is in, where the caret is;
 *   - each next one takes the line below when that is a line for writing only
 *     and is still empty;
 *   - otherwise — the line below has writing, or is one the form labels
 *     ("5. Chẩn đoán…"), or there is none — a line is added right there, as
 *     Enter adds one, and what was below moves down. Nothing written is lost,
 *     and nothing goes into another label's blank;
 *   - what stood after the caret goes on at the end of the last line pasted.
 *
 * Only text is pasted, never the copied page's formatting. A blank outside any
 * line keeps the breaks within itself, as before. The paste is one step for
 * Ctrl+Z (sheetHistory).
 */

const ANY_TEXT_BLANK = '[data-field-type="text"]';
const BLOCK_SELECTOR = "p, h1, h2, h3, h4, li";
/** The tag a paste over a selection across lines gives its erasing, to be one step with the paste. */
export const PASTE_STEP = "paste";

function elementOf(node: Node): Element | null {
  return node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement;
}

/** The pasted text with its lines broken by "\n", or null when there is no text to paste. */
export function pastedText(data: DataTransfer): string | null {
  const text = data
    .getData("text/plain")
    .replace(/\r\n?/g, "\n")
    .replace(/\t/g, " ")
    .replace(/\n$/, "");
  return text === "" ? null : text;
}

/** The blank of a line for writing only, if `block` is one and nothing is written on it. */
function emptyWritingLine(block: Element | null): Element | null {
  if (!block?.matches(BLOCK_SELECTOR) || block.hasAttribute(FLOW_LINE_ATTR)) return null;
  const fields = block.querySelectorAll(FIELD_SELECTOR);
  const blank = fields[0];
  if (fields.length !== 1 || !blank.matches(ANY_TEXT_BLANK) || !isEditableBlank(blank)) return null;
  return (block.textContent ?? "").trim() === "" ? blank : null;
}

/** The blank the next pasted line goes in, under `blank`: an empty line below, or one added. */
function lineBelow(blank: Element): Element | null {
  const end = lineEnd(blank);
  return emptyWritingLine(end.nextElementSibling) ?? addLineAfter(blank, end);
}

/** Writes `text` over `owner`'s value from `start` to `end`, line by line. */
export function pasteLines(owner: Element, start: number, end: number, text: string) {
  const value = flowedText(owner);
  const head = value.slice(0, start);
  const tail = value.slice(end);
  const [first, ...rest] = text.split("\n");

  if (rest.length === 0 || !owner.closest(BLOCK_SELECTOR)) {
    writeFlowed(owner, `${head}${text}${tail}`);
    placeCaretAt(owner, head.length + text.length);
    return;
  }

  let current = owner;
  let written = `${head}${first}`;
  let left = rest;
  const grown = new Set<Element>();
  writeFlowed(owner, written);
  while (left.length > 0) {
    const next = lineBelow(current);
    // Only a blank outside any line has none; the first is in one, and so is every line under it.
    if (!next) break;
    if (next.closest(`[${GENERATED_ROW_ATTR}]`)) grown.add(next);
    [written, ...left] = left;
    writeFlowed(next, written);
    current = next;
  }
  const last = [written, ...left].join("\n");
  writeFlowed(current, `${last}${tail}`);
  grown.forEach(renumberLines);
  placeCaretAt(current, last.length);
}

/** Listens for a paste into the sheet's blanks; `onChanged` hears of it as an edit. */
export function attachSheetPaste(doc: Document, history: SheetHistory, onChanged: () => void): () => void {
  const onPaste = (event: ClipboardEvent) => {
    if (event.defaultPrevented || !event.clipboardData) return;
    const selection = doc.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    const host = elementOf(range.startContainer)?.closest(ANY_TEXT_BLANK);
    const owner = host ? flowOwner(host) : null;
    if (!host || !owner || host.getAttribute("contenteditable") !== "true") return;

    const start = offsetInFlowed(owner, range.startContainer, range.startOffset);
    const end = offsetInFlowed(owner, range.endContainer, range.endOffset);
    const text = pastedText(event.clipboardData);
    if (start === null || end === null || text === null) return;

    event.preventDefault();
    history.record(() => pasteLines(owner, start, end, text), { join: PASTE_STEP });
    onChanged();
  };

  doc.addEventListener("paste", onPaste);
  return () => doc.removeEventListener("paste", onPaste);
}
