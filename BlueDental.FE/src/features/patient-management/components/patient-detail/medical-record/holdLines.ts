/**
 * Forms 2–10 print their letters larger than drawn (sheetCss,
 * --nfc-letter-height), but the clinic keeps every line and every page as they
 * were (2026-11-14, R-1234: "thay đổi font size mà k ảnh hưởng layout và trang
 * hiện tại"). Wider letters push a sentence's last word, a tick box or the
 * letterhead's long line onto a line of their own.
 *
 * So, once fitBlanks has shortened what blanks it can, each block that now runs
 * to more lines than with the letters as drawn takes its letters down a step at
 * a time until it is back to its lines — at worst to the letters as drawn. Only
 * those blocks: every other line keeps the full size.
 *
 * Only how the sheet is drawn, like fitBlanks: the print copy (printing.ts) is
 * cloned from this document, so it carries the same steps — taken again just
 * before the copy, for what has been written since the sheet opened.
 */

const SHEET_SELECTOR = '.nfc-tpl[data-form]:not([data-form="1"])';
const BLOCK_SELECTOR = "p, h1, h2, h3, h4, li, td, th";
/** Times New Roman's own lower case: the letters as drawn. */
const DRAWN_LETTER_HEIGHT = 0.45;
const STEP = 0.01;

/** The letters' height the sheet is set to, or 0 where the browser has no font-size-adjust. */
function enlargedLetterHeight(sheet: HTMLElement): number {
  const value = sheet.ownerDocument.defaultView?.getComputedStyle(sheet).fontSizeAdjust ?? "";
  const number = parseFloat(value.match(/\d*\.?\d+/)?.[0] ?? "");
  return Number.isFinite(number) ? number : 0;
}

/** Blocks holding text only — a cell's height is its row's, so it is never measured. */
function textBlocks(sheet: HTMLElement): HTMLElement[] {
  return Array.from(sheet.querySelectorAll<HTMLElement>(BLOCK_SELECTOR)).filter(
    (block) => !block.querySelector(BLOCK_SELECTOR),
  );
}

/** How many lines the block's text runs to: its boxes grouped by where they sit. */
function lineCount(block: HTMLElement): number {
  const style = block.ownerDocument.defaultView?.getComputedStyle(block);
  const fontSize = parseFloat(style?.fontSize ?? "") || 16;
  const pitch = parseFloat(style?.lineHeight ?? "") || fontSize * 1.2;

  const range = block.ownerDocument.createRange();
  range.selectNodeContents(block);
  const middles = Array.from(range.getClientRects())
    .filter((rect) => rect.width > 0 && rect.height > 0)
    .map((rect) => (rect.top + rect.bottom) / 2)
    .sort((a, b) => a - b);

  return middles.reduce(
    (lines, middle, at) => (at > 0 && middle - middles[at - 1] > pitch / 2 ? lines + 1 : lines),
    middles.length > 0 ? 1 : 0,
  );
}

/** Takes the block's letters down until it is back to its lines, or to the letters as drawn. */
function stepDown(block: HTMLElement, from: number, lines: number) {
  for (let height = from - STEP; height > DRAWN_LETTER_HEIGHT + STEP / 2; height -= STEP) {
    block.style.fontSizeAdjust = height.toFixed(2);
    if (lineCount(block) <= lines) return;
  }
  block.style.fontSizeAdjust = "none";
}

/** Keeps every block of the sheet to the lines it runs to with the letters as drawn. */
export function holdLines(doc: Document) {
  const sheet = doc.querySelector<HTMLElement>(SHEET_SELECTOR);
  if (!sheet) return;
  const enlarged = enlargedLetterHeight(sheet);
  if (enlarged <= DRAWN_LETTER_HEIGHT) return;

  // From the full size again: run once more before printing, a block may now
  // hold more text, or less, than when it last stepped down.
  const blocks = textBlocks(sheet);
  blocks.forEach((block) => block.style.removeProperty("font-size-adjust"));
  const before = sheet.style.fontSizeAdjust;
  sheet.style.fontSizeAdjust = "none";
  const drawn = blocks.map(lineCount);
  sheet.style.fontSizeAdjust = before;
  const now = blocks.map(lineCount);

  blocks.forEach((block, at) => {
    if (now[at] > drawn[at]) stepDown(block, enlarged, drawn[at]);
  });
}
