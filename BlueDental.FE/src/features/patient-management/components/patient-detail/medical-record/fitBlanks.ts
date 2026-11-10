/**
 * Mẫu 2's blanks are drawn at fixed widths for 13px type: each line of the
 * form — label, blank, label, blank — fills the writing area at that size and
 * no more. Set in larger type (clinic, 2026-11-10: "in ra nhìn nhỏ xíu") the
 * labels widen, the last blank on a line no longer fits beside them and drops
 * to a line of its own, and every page of the form runs onto a second sheet.
 *
 * So once the sheet is laid out, each line that held on one line at the size
 * the blanks were drawn for, and no longer does, gives back what its labels
 * gained: its widest blanks are shortened until the line fits again. The
 * form keeps its lines; only the dotted stretch after a label is shorter.
 *
 * Only how the sheet is drawn, like flowLines: the widths are not stored, and
 * the print copy (printing.ts) is cloned from this document so it carries them.
 * Runs before flowLongBlanks, which breaks a blank's text at its width.
 */

/** The forms set larger than the size their blanks were drawn for. */
const FITTED_SHEET_SELECTOR = '.nfc-tpl[data-form="2"]';
/** The type size mẫu 2's blank widths were drawn for (R-1067). */
const DRAWN_FONT_SIZE = "13px";
/** A blank is never shortened below this — still room to write a word. */
const MIN_BLANK_WIDTH = 40;

const BLOCK_SELECTOR = "p, h1, h2, h3, h4, li";
const TEXT_BLANK_SELECTOR = '[data-medical-record-field][data-field-type="text"]';
/** Laid out by their own rules (sheetCss): the vitals and the MS column already fit their cells. */
const SKIPPED_SELECTOR = '[data-grid-cell], table[data-record-section="vitals"], .record-ids';

function heightOf(element: Element): number {
  return element.getBoundingClientRect().height;
}

/** How far the block's content runs past its right edge when kept on one line. */
function overflowOnOneLine(block: HTMLElement): number {
  const doc = block.ownerDocument;
  const style = doc.defaultView?.getComputedStyle(block);
  if (!style) return 0;

  const before = block.style.whiteSpace;
  block.style.whiteSpace = "nowrap";
  const range = doc.createRange();
  range.selectNodeContents(block);
  // A range's box stops at its boxes' borders, but the line has to hold their
  // right margins too: line 13 ends in a tick box with 3px after it, and
  // leaving that out shortened the blank 2px too little — the box still
  // dropped to a line of its own (clinic, 2026-11-10).
  const contentRight = Array.from(block.querySelectorAll("*")).reduce(
    (right, element) =>
      Math.max(
        right,
        element.getBoundingClientRect().right +
          (parseFloat(doc.defaultView?.getComputedStyle(element).marginRight ?? "") || 0),
      ),
    range.getBoundingClientRect().right,
  );
  const edge = block.getBoundingClientRect().right - parseFloat(style.paddingRight);
  block.style.whiteSpace = before;

  return contentRight - edge;
}

/** Fixed-width blanks only: a blank set to the line's full width already wraps by design. */
function shrinkableBlanks(block: Element): HTMLElement[] {
  return Array.from(block.querySelectorAll<HTMLElement>(TEXT_BLANK_SELECTOR))
    .filter((blank) => blank.style.width === "" && parseFloat(blank.style.minWidth) > MIN_BLANK_WIDTH)
    .sort((a, b) => parseFloat(b.style.minWidth) - parseFloat(a.style.minWidth));
}

/** Shortens the block's widest blanks, widest first, until the line fits. */
function fitBlock(block: HTMLElement) {
  // A pixel more than measured: sub-pixel text widths round either way.
  let overflow = overflowOnOneLine(block) + 1;
  if (overflow <= 1) return;

  for (const blank of shrinkableBlanks(block)) {
    const width = parseFloat(blank.style.minWidth);
    const next = Math.max(MIN_BLANK_WIDTH, Math.floor(width - overflow));
    blank.style.minWidth = `${next}px`;
    overflow -= width - next;
    if (overflow <= 0) return;
  }
}

/** Gives every line that held on one line at the drawn size its one line back. */
export function fitBlanksToLines(doc: Document) {
  const sheet = doc.querySelector<HTMLElement>(FITTED_SHEET_SELECTOR);
  if (!sheet) return;

  const blocks = Array.from(sheet.querySelectorAll<HTMLElement>(BLOCK_SELECTOR)).filter(
    (block) => block.querySelector(TEXT_BLANK_SELECTOR) && !block.closest(SKIPPED_SELECTOR),
  );
  if (blocks.length === 0) return;

  // One line at the drawn size: shorter than a line and a half.
  const before = sheet.style.fontSize;
  sheet.style.fontSize = DRAWN_FONT_SIZE;
  const oneLine = blocks.map((block) => {
    const lineHeight = parseFloat(doc.defaultView?.getComputedStyle(block).lineHeight ?? "") || 0;
    return lineHeight > 0 && heightOf(block) < lineHeight * 1.5;
  });
  sheet.style.fontSize = before;

  blocks.forEach((block, at) => {
    if (oneLine[at]) fitBlock(block);
  });
}
