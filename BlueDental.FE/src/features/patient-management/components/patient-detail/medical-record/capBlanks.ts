/**
 * A blank after a label takes at most the rest of its line (clinic,
 * 2026-11-25): a blank is an inline-block, and an inline-block grows with what
 * is written in it up to the width of the whole block, not of what is left of
 * the line. Written long — "Chưa phát hiện gì bất thường000…" after "+ Bản
 * thân:" — it ran past the right margin by as much as the label before it, and
 * on a line kept to one line it carried everything after it off the sheet.
 *
 * So once the sheet is laid out, each line's blanks share the room the line
 * has: measured with every blank held at its drawn width, it is what is left
 * between the line's end and the edge of its block (or cell) — on a centred
 * or right-aligned line, what is left before its start as well. A blank keeps
 * the width it is drawn at with what it holds now — all of them less, in
 * proportion, if together they already run past the edge — and the last blank
 * on the line takes what room is left over. Past its cap a blank wraps inside
 * itself (the sheet breaks even an unbroken run of letters there, sheetCss),
 * and flowLongBlanks, which runs next, breaks it on to lines of its own.
 *
 * A line that runs past its edge even at the drawn widths — fitBlanks finds
 * only lines that sit on one line, and a sheet opened with a blank written
 * long is taller than that — has its widest blanks shortened until it fits,
 * as fitBlanks would have (`shortened`).
 *
 * A sheet that fits stays exactly as it was. The cap is the blank's own style,
 * so it holds while writing and is carried into the print copy (printing.ts
 * clones this document). Blanks drawn at no width of their own, and blanks set
 * to their line's full width, are left alone.
 */

const BLOCK_SELECTOR = "p, h1, h2, h3, h4, li, td, th";
const TEXT_BLANK_SELECTOR = '[data-medical-record-field][data-field-type="text"]';

/** Pixels of a computed length, 0 when it is not one. */
function px(value: string): number {
  return parseFloat(value) || 0;
}

/**
 * A blank's drawn width: its min-width, which a few forms give as
 * `min(40px, 100%)` — the pixels in it, then.
 */
function drawnWidth(minWidth: string): number {
  return parseFloat(minWidth.match(/-?\d*\.?\d+(?=px)/)?.[0] ?? "") || 0;
}

interface Blank {
  element: HTMLElement;
  block: Element;
  drawn: number;
  /** As laid out with what it holds, before any cap. */
  natural: number;
  /** Held at its drawn width. */
  held: DOMRect;
  style: { maxWidth: string; whiteSpace: string; overflow: string };
}

/** Blanks drawn at a width of their own, as inline-blocks on a line with other things. */
function cappableBlanks(sheet: HTMLElement): Array<{ element: HTMLElement; block: Element; drawn: number }> {
  const view = sheet.ownerDocument.defaultView;
  if (!view) return [];
  return Array.from(sheet.querySelectorAll<HTMLElement>(TEXT_BLANK_SELECTOR)).flatMap((element) => {
    if (element.style.width !== "" || element.hasAttribute("data-flow-of")) return [];
    const block = element.parentElement?.closest(BLOCK_SELECTOR);
    const style = view.getComputedStyle(element);
    const drawn = drawnWidth(style.minWidth);
    return block && style.display === "inline-block" && drawn > 0 ? [{ element, block, drawn }] : [];
  });
}

/** Whether a box sits on the line: it overlaps the line by more than a pixel top to bottom. */
function onLine(box: DOMRect, line: DOMRect): boolean {
  return box.width > 0 && box.top < line.bottom - 1 && box.bottom > line.top + 1;
}

/**
 * How far left and right anything on the line runs: the block's own text and
 * boxes, a box's margins included. What is written inside a blank does not
 * count — only the blank's box, held at its drawn width.
 */
function lineExtent(block: Element, line: DOMRect): { left: number; right: number } {
  const doc = block.ownerDocument;
  const view = doc.defaultView;
  let left = Number.POSITIVE_INFINITY;
  let right = Number.NEGATIVE_INFINITY;

  const walker = doc.createTreeWalker(block, NodeFilter.SHOW_TEXT);
  const range = doc.createRange();
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node.parentElement?.closest(TEXT_BLANK_SELECTOR)) continue;
    range.selectNodeContents(node);
    for (const box of Array.from(range.getClientRects())) {
      if (!onLine(box, line)) continue;
      left = Math.min(left, box.left);
      right = Math.max(right, box.right);
    }
  }

  for (const element of Array.from(block.querySelectorAll("*"))) {
    if (element.parentElement?.closest(TEXT_BLANK_SELECTOR)) continue;
    const box = element.getBoundingClientRect();
    if (!onLine(box, line)) continue;
    const style = view?.getComputedStyle(element);
    left = Math.min(left, box.left - px(style?.marginLeft ?? ""));
    right = Math.max(right, box.right + px(style?.marginRight ?? ""));
  }
  return { left, right };
}

/** The right edge of a box's writing area: inside its padding and border. */
function innerRight(box: Element): number {
  const style = box.ownerDocument.defaultView?.getComputedStyle(box);
  return box.getBoundingClientRect().right - px(style?.paddingRight ?? "") - px(style?.borderRightWidth ?? "");
}

/** The left edge of a box's writing area: inside its padding and border. */
function innerLeft(box: Element): number {
  const style = box.ownerDocument.defaultView?.getComputedStyle(box);
  return box.getBoundingClientRect().left + px(style?.paddingLeft ?? "") + px(style?.borderLeftWidth ?? "");
}

/** Where the line may start: its block's edge, or its cell's if the block runs past it. */
function startOf(block: Element): number {
  const cell = block.closest("td, th");
  return cell && cell !== block ? Math.max(innerLeft(block), innerLeft(cell)) : innerLeft(block);
}

/**
 * A centred or right-aligned line grows to its left as well, so the room
 * before it is the blank's too: a name under a signature, centred in its
 * column, takes the column's whole width before it wraps — not only the right
 * half of it (clinic, 2026-11-26, R-1325).
 */
function growsLeft(block: Element): boolean {
  const align = block.ownerDocument.defaultView?.getComputedStyle(block).textAlign ?? "";
  return align === "center" || align === "-webkit-center" || align === "right" || align === "end";
}

/** Where the line ends: its block's edge, or its cell's if the block runs past it. */
function edgeOf(block: Element): number {
  const cell = block.closest("td, th");
  return cell && cell !== block ? Math.min(innerRight(block), innerRight(cell)) : innerRight(block);
}

/** Measures every blank as it is, then held at its drawn width on one line. */
function measure(found: Array<{ element: HTMLElement; block: Element; drawn: number }>): Blank[] {
  const natural = found.map(({ element }) => {
    element.style.maxWidth = "";
    return element.getBoundingClientRect().width;
  });
  const styles = found.map(({ element }) => ({
    maxWidth: element.style.maxWidth,
    whiteSpace: element.style.whiteSpace,
    overflow: element.style.overflow,
  }));
  found.forEach(({ element, drawn }) => {
    element.style.maxWidth = `${drawn}px`;
    element.style.whiteSpace = "nowrap";
    element.style.overflow = "hidden";
  });
  return found.map((blank, at) => ({
    ...blank,
    natural: natural[at],
    held: blank.element.getBoundingClientRect(),
    style: styles[at],
  }));
}

/** The blanks on one line of one block, left to right. */
function lines(blanks: Blank[]): Blank[][] {
  const grouped: Blank[][] = [];
  for (const blank of blanks) {
    const line = grouped.find((group) => group[0].block === blank.block && onLine(group[0].held, blank.held));
    if (line) line.push(blank);
    else grouped.push([blank]);
  }
  return grouped.map((line) => line.sort((a, b) => a.held.left - b.held.left));
}

/** A blank is never taken below this — still room to write a word (as fitBlanks). */
const MIN_BLANK_WIDTH = 40;

/**
 * The line runs past its edge even with its blanks at their drawn widths:
 * fitBlanks shortens such a line's blanks, but only a line it finds on one
 * line, and a blank already written long has made its line taller. The
 * widest blanks give back what the line runs over, widest first.
 */
function shortened(line: Blank[], over: number): number[] {
  const caps = line.map((blank) => blank.held.width);
  const widest = line.map((_, at) => at).sort((a, b) => caps[b] - caps[a]);
  let left = over;
  for (const at of widest) {
    if (left <= 0) break;
    const next = Math.max(MIN_BLANK_WIDTH, caps[at] - left);
    left -= caps[at] - next;
    caps[at] = next;
  }
  return caps.map((cap) => Math.floor(cap));
}

/** Each blank's cap on its line: what it uses now, scaled down if the line runs over, the rest to the last. */
function capsOf(line: Blank[]): number[] {
  const last = line[line.length - 1];
  const extent = lineExtent(last.block, last.held);
  const free = edgeOf(last.block) - extent.right;
  if (free < -1) return shortened(line, -free);
  const before = growsLeft(last.block) ? Math.max(0, extent.left - startOf(last.block)) : 0;
  const room = Math.max(0, free) + before;
  const grown = line.map((blank) => Math.max(0, blank.natural - blank.held.width));
  const used = grown.reduce((sum, width) => sum + width, 0);
  const scale = used > room ? room / used : 1;
  const left = room - used * scale;
  return line.map((blank, at) => {
    const own = blank.held.width + grown[at] * scale;
    // Up, not down: a pixel under what a blank uses now would wrap its text.
    return Math.ceil(at === line.length - 1 ? own + left : own);
  });
}

/**
 * A cap measured on the blank's box, as its max-width: less its padding and
 * border where the max-width is of the content alone (most blanks).
 */
function asMaxWidth(element: HTMLElement, cap: number): number {
  const style = element.ownerDocument.defaultView?.getComputedStyle(element);
  if (!style || style.boxSizing === "border-box") return cap;
  return Math.max(
    0,
    cap -
      px(style.paddingLeft) -
      px(style.paddingRight) -
      px(style.borderLeftWidth) -
      px(style.borderRightWidth),
  );
}

/** Lets every blank grow to the end of its line and no further. */
export function capBlanksToLines(doc: Document) {
  const sheet = doc.querySelector<HTMLElement>(".nfc-tpl");
  if (!sheet) return;

  const blanks = measure(cappableBlanks(sheet));
  const caps = new Map<HTMLElement, number>();
  for (const line of lines(blanks)) {
    capsOf(line).forEach((cap, at) => caps.set(line[at].element, cap));
  }

  for (const { element, style, held } of blanks) {
    element.style.whiteSpace = style.whiteSpace;
    element.style.overflow = style.overflow;
    const cap = caps.get(element) ?? held.width;
    element.style.maxWidth = `${asMaxWidth(element, cap)}px`;
    // Shortened under its drawn width: the min-width gives way too, or it would win.
    if (cap < held.width - 0.5) element.style.minWidth = `${asMaxWidth(element, cap)}px`;
  }
}
