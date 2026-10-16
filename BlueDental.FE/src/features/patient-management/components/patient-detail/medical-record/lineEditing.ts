import { FIELD_SELECTOR, GENERATED_ROW_ATTR } from "./rowEditing";

/**
 * Enter inside a blank, as the reference does it (staging, 2026-10-16; see
 * docs/clone/pages/patient-detail.md §Bệnh án — Enter):
 *
 *   - the block right under the blank's own has a blank → the caret goes to
 *     the first one, nothing is added ("Họ tên" → "Địa chỉ", not the
 *     "Ngày sinh" beside it);
 *   - otherwise → a new line holding one empty blank, as wide as this one, is
 *     put right under it and the caret goes there. The line keeps its block's
 *     alignment, so under a right-aligned "Mã hồ sơ:" the blanks stack in a
 *     column; in a left-aligned block it starts at the margin, as on the
 *     reference. In a table cell that line stays in the cell; the table gains
 *     no row.
 *
 * Backspace or Delete in an added line that is already empty takes the line
 * away again (owner, 2026-10-16): Backspace hands the caret to the end of the
 * blank above, Delete to the start of the blank below, or above when there is
 * none. A blank the form prints is never taken away, and one with words in it
 * loses them a character at a time first, as anywhere else.
 *
 * An added line is a blank like any other, stored under
 * `custom.line.<anchor>.<n>` — the blank it grew from, and its place in the
 * run — so the sheet can be drawn back with it in the same spot.
 */

const LINE_PREFIX = "custom.line.";
const LINE_KEY = /^custom\.line\.(.+)\.(\d+)$/;

/** The blocks a blank sits in, and the ones Enter looks at under it. */
const BLOCK_SELECTOR = "p, h1, h2, h3, h4, li";
const TEXT_BLANK_SELECTOR = `${FIELD_SELECTOR}[data-field-type="text"]`;

/** What an added line copies from the block it grew under: its alignment. */
const COPIED_BLOCK_ATTRIBUTES = ["style", "data-block-align"];

/** The attributes an added blank copies from the one it grew from. */
const COPIED_ATTRIBUTES = [
  "class",
  "data-field-type",
  "data-field-width",
  "data-field-full-width",
  "data-placeholder",
  "style",
];

interface LineKey {
  anchor: string;
  at: number;
}

function parseLineKey(id: string): LineKey | null {
  const match = id.match(LINE_KEY);
  return match ? { anchor: match[1], at: Number(match[2]) } : null;
}

function lineKey(anchor: string, at: number): string {
  return `${LINE_PREFIX}${anchor}.${at}`;
}

function blockOf(blank: Element): Element | null {
  return blank.closest(BLOCK_SELECTOR);
}

/** Every line already grown from `anchor`, wherever it sits. */
function linesOf(root: ParentNode, anchor: string): Element[] {
  return Array.from(root.querySelectorAll(`[data-medical-record-field^="${LINE_PREFIX}"]`)).filter(
    (node) => parseLineKey(node.getAttribute("data-medical-record-field") ?? "")?.anchor === anchor,
  );
}

function newLine(doc: Document, source: Element, block: Element, id: string): HTMLParagraphElement {
  const line = doc.createElement("p");
  for (const name of COPIED_BLOCK_ATTRIBUTES) {
    const value = block.getAttribute(name);
    if (value !== null) line.setAttribute(name, value);
  }
  line.setAttribute(GENERATED_ROW_ATTR, "true");

  const blank = doc.createElement("span");
  for (const name of COPIED_ATTRIBUTES) {
    const value = source.getAttribute(name);
    if (value !== null) blank.setAttribute(name, value);
  }
  blank.setAttribute("data-medical-record-field", id);
  if (source.getAttribute("contenteditable") === "true") blank.setAttribute("contenteditable", "true");

  line.append(blank);
  return line;
}

function placeCaret(blank: HTMLElement, atStart = false) {
  const doc = blank.ownerDocument;
  blank.focus();
  const range = doc.createRange();
  range.selectNodeContents(blank);
  range.collapse(atStart);
  const selection = doc.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}

/**
 * What Enter does in `blank`: moves on, or adds a line. Returns the blank the
 * caret is now in, or null when it did nothing (a blank outside any block).
 */
export function enterInBlank(blank: HTMLElement): HTMLElement | null {
  const block = blockOf(blank);
  if (!block) return null;

  /*
   * Only a block of text counts as "under" — a table that follows is a block
   * of its own, which the reference was not seen stepping into.
   * UNKNOWN_REFERENCE_BEHAVIOR: Enter right above a table.
   */
  const below = block.nextElementSibling;
  const next = below?.matches(BLOCK_SELECTOR) ? below.querySelector<HTMLElement>(TEXT_BLANK_SELECTOR) : null;
  if (next) {
    placeCaret(next);
    return next;
  }

  const id = blank.getAttribute("data-medical-record-field") ?? "";
  const anchor = parseLineKey(id)?.anchor ?? id;
  const highest = linesOf(block.ownerDocument, anchor).reduce(
    (most, node) => Math.max(most, parseLineKey(node.getAttribute("data-medical-record-field") ?? "")?.at ?? 0),
    0,
  );

  const line = newLine(block.ownerDocument, blank, block, lineKey(anchor, highest + 1));
  block.insertAdjacentElement("afterend", line);
  const added = line.firstElementChild as HTMLElement;
  placeCaret(added);
  return added;
}

function lastBlankIn(block: Element | null): HTMLElement | null {
  if (!block?.matches(BLOCK_SELECTOR)) return null;
  const blanks = block.querySelectorAll<HTMLElement>(TEXT_BLANK_SELECTOR);
  return blanks[blanks.length - 1] ?? null;
}

function firstBlankIn(block: Element | null): HTMLElement | null {
  return block?.matches(BLOCK_SELECTOR) ? block.querySelector<HTMLElement>(TEXT_BLANK_SELECTOR) : null;
}

/**
 * Takes an empty added line away and hands the caret on. Returns whether it
 * did: a blank the form prints, or one with words left in it, stays.
 */
export function removeEmptyLine(blank: HTMLElement, direction: "backward" | "forward"): boolean {
  const id = blank.getAttribute("data-medical-record-field") ?? "";
  const key = parseLineKey(id);
  if (!key || blank.textContent !== "") return false;

  const line = blank.closest(`p[${GENERATED_ROW_ATTR}]`);
  if (!line) return false;

  const doc = line.ownerDocument;
  const above =
    lastBlankIn(line.previousElementSibling) ??
    doc.querySelector<HTMLElement>(`[data-medical-record-field="${key.anchor}"]`);
  const below = firstBlankIn(line.nextElementSibling);

  line.remove();
  if (direction === "forward" && below) placeCaret(below, true);
  else if (above) placeCaret(above);
  return true;
}

/**
 * Listens for Enter, Backspace and Delete on an open sheet and returns the
 * call that stops listening. Shift+Enter is left to the browser: a line break
 * inside the blank. UNKNOWN_REFERENCE_BEHAVIOR: what the reference does with
 * it, and with Backspace / Delete (the owner's rule above stands in).
 */
export function attachLineEditing(doc: Document, onChanged: () => void): () => void {
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.isComposing) return;
    const blank = (event.target as Element | null)?.closest?.<HTMLElement>(TEXT_BLANK_SELECTOR);
    if (!blank) return;

    if (event.key === "Backspace" || event.key === "Delete") {
      if (!removeEmptyLine(blank, event.key === "Delete" ? "forward" : "backward")) return;
      event.preventDefault();
      onChanged();
      return;
    }

    if (event.key !== "Enter" || event.shiftKey) return;
    event.preventDefault();
    const before = doc.querySelectorAll(FIELD_SELECTOR).length;
    enterInBlank(blank);
    if (doc.querySelectorAll(FIELD_SELECTOR).length !== before) onChanged();
  };

  doc.addEventListener("keydown", onKeyDown);
  return () => doc.removeEventListener("keydown", onKeyDown);
}

/**
 * Draws back the lines a sheet was saved with, each under the blank it grew
 * from, in order. A line whose blank the form no longer prints is dropped.
 */
export function applyStoredLines(root: ParentNode, stored: Record<string, unknown>) {
  const byAnchor = new Map<string, number[]>();
  for (const id of Object.keys(stored)) {
    const key = parseLineKey(id);
    if (!key) continue;
    byAnchor.set(key.anchor, [...(byAnchor.get(key.anchor) ?? []), key.at]);
  }

  for (const [anchor, positions] of byAnchor) {
    const source = root.querySelector(`[data-medical-record-field="${anchor}"]`);
    const block = source ? blockOf(source) : null;
    if (!source || !block) continue;

    let after: Element = block;
    for (const at of [...positions].sort((a, b) => a - b)) {
      const line = newLine(block.ownerDocument, source, block, lineKey(anchor, at));
      after.insertAdjacentElement("afterend", line);
      after = line;
    }
  }
}
