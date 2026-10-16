import {
  PAGE_PX_PER_POINT,
  SKETCH_LINE_HEIGHT,
  SKETCH_WIDTH,
  sameRunStyle,
  type RunStyle,
  type TextRun,
} from "./sketch";

/**
 * The words of a text box as runs — stretches in one style — and the editable
 * element that shows them: one span per run, a <br> per line break.
 *
 * The browser types into the element as it likes; the runs are read back off
 * it when they are needed, and written into it afresh only when a style is
 * put on a stretch, so typing (Vietnamese input methods included) is never
 * disturbed by a re-render.
 */

/** Holds the caret where a style was picked with nothing selected, until a letter is typed there. */
export const MARK = "​";

/** Characters from–to, counting a line break as one. */
export interface CharSpan {
  start: number;
  end: number;
}

export type RunLook = Omit<TextRun, "text">;
export type RunPatch = Partial<RunStyle> & { color?: string };

// ---------------------------------------------------------------- the runs

export function textOf(runs: readonly TextRun[]): string {
  return runs.map((run) => run.text).join("");
}

/** Empty runs dropped, neighbours in the same look joined. */
export function mergeRuns(runs: readonly TextRun[]): TextRun[] {
  const out: TextRun[] = [];
  for (const run of runs) {
    if (!run.text) continue;
    const last = out[out.length - 1];
    if (last && last.color === run.color && sameRunStyle(last.style, run.style)) {
      out[out.length - 1] = { ...last, text: last.text + run.text };
    } else {
      out.push(run);
    }
  }
  return out;
}

function splitAt(runs: readonly TextRun[], at: number): TextRun[] {
  let pos = 0;
  return runs.flatMap((run) => {
    const from = pos;
    pos += run.text.length;
    if (at <= from || at >= pos) return [run];
    return [{ ...run, text: run.text.slice(0, at - from) }, { ...run, text: run.text.slice(at - from) }];
  });
}

export function patchLook(look: RunLook, { color, ...style }: RunPatch): RunLook {
  return { color: color ?? look.color, style: { ...look.style, ...style } };
}

/** The stretch from–to in the new look, the rest as it was. */
export function patchRuns(runs: readonly TextRun[], span: CharSpan, patch: RunPatch): TextRun[] {
  let pos = 0;
  const cut = splitAt(splitAt(runs, span.start), span.end);
  return cut.map((run) => {
    const from = pos;
    pos += run.text.length;
    return from >= span.start && from < span.end ? { text: run.text, ...patchLook(run, patch) } : run;
  });
}

/** The stretch from–to replaced by words in one look; a mark is put down with this too. */
export function spliceRuns(runs: readonly TextRun[], span: CharSpan, text: string, look: RunLook): TextRun[] {
  let pos = 0;
  const before: TextRun[] = [];
  const after: TextRun[] = [];
  for (const run of splitAt(splitAt(runs, span.start), span.end)) {
    const from = pos;
    pos += run.text.length;
    if (from < span.start) before.push(run);
    else if (from >= span.end) after.push(run);
  }
  return mergeRuns([...before, { text, ...look }, ...after]);
}

/** The run a character is in. */
export function runAt(runs: readonly TextRun[], index: number): TextRun | undefined {
  let pos = 0;
  return runs.find((run) => {
    pos += run.text.length;
    return index < pos;
  });
}

/** What is put down: marks gone, nothing trailing after the last word. */
export function finishRuns(runs: readonly TextRun[]): TextRun[] {
  const out = mergeRuns(runs.map((run) => ({ ...run, text: run.text.split(MARK).join("") })));
  while (out.length) {
    const last = out[out.length - 1];
    const text = last.text.replace(/\s+$/, "");
    if (text) {
      out[out.length - 1] = { ...last, text };
      break;
    }
    out.pop();
  }
  return out;
}

// ------------------------------------------------------------- the element

/** Styles a span the way the run is drawn on the page, sized in page pixels. */
export function paintSpan(span: HTMLElement, look: RunLook) {
  const { style, color } = look;
  span.style.fontFamily = `"${style.font}", sans-serif`;
  span.style.fontSize = `calc(${style.points * PAGE_PX_PER_POINT} * 100cqw / ${SKETCH_WIDTH})`;
  span.style.fontWeight = style.bold ? "700" : "400";
  span.style.fontStyle = style.italic ? "italic" : "normal";
  span.style.textDecorationLine = [style.underline && "underline", style.strike && "line-through"].filter(Boolean).join(" ") || "none";
  span.style.lineHeight = String(SKETCH_LINE_HEIGHT);
  span.style.color = color;
}

export function writeRuns(root: HTMLElement, runs: readonly TextRun[]) {
  root.replaceChildren();
  let last: HTMLElement = root;
  for (const run of mergeRuns(runs)) {
    const span = document.createElement("span");
    paintSpan(span, run);
    run.text.split("\n").forEach((part, at) => {
      if (at > 0) span.append(document.createElement("br"));
      if (part) span.append(part);
    });
    root.append(span);
    last = span;
  }
  // A line break at the very end shows a line only with another after it.
  const text = textOf(runs);
  if (!text || text.endsWith("\n")) last.append(document.createElement("br"));
}

/** The text nodes and line breaks, in order. */
function leavesOf(root: Node): Array<Text | HTMLBRElement> {
  const leaves: Array<Text | HTMLBRElement> = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node instanceof Text ? node.data.length > 0 : node.nodeName === "BR") leaves.push(node as Text | HTMLBRElement);
  }
  return leaves;
}

function toHex(color: string): string {
  const parts = color.match(/\d+(\.\d+)?/g);
  if (!parts || parts.length < 3) return color;
  return `#${parts.slice(0, 3).map((part) => Math.round(Number(part)).toString(16).padStart(2, "0")).join("")}`;
}

/** The look of a leaf as the browser shows it — whatever spans the browser itself made while typing. */
function lookOf(leaf: Node, root: HTMLElement, scale: number): RunLook {
  const element = leaf.parentElement ?? root;
  const computed = getComputedStyle(element);
  const decorations = new Set<string>();
  for (let at: HTMLElement | null = element; at && root.contains(at); at = at.parentElement) {
    for (const line of getComputedStyle(at).textDecorationLine.split(" ")) decorations.add(line);
  }
  return {
    color: toHex(computed.color),
    style: {
      font: computed.fontFamily.split(",")[0].trim().replace(/^["']|["']$/g, ""),
      points: Math.round(parseFloat(computed.fontSize) / (scale * PAGE_PX_PER_POINT)) || 11,
      bold: Number(computed.fontWeight) >= 600,
      italic: computed.fontStyle !== "normal",
      underline: decorations.has("underline"),
      strike: decorations.has("line-through"),
    },
  };
}

/** The runs the element shows now, marks kept; `scale` is CSS pixels per page pixel. */
export function readRuns(root: HTMLElement, scale: number): TextRun[] {
  const leaves = leavesOf(root);
  const runs: TextRun[] = [];
  leaves.forEach((leaf, at) => {
    // The <br> that only lets an empty last line show is not a line break of its own.
    if (!(leaf instanceof Text) && at === leaves.length - 1) return;
    runs.push({ text: leaf instanceof Text ? leaf.data : "\n", ...lookOf(leaf, root, scale) });
  });
  return mergeRuns(runs);
}

function charsIn(fragment: Node): number {
  return leavesOf(fragment).reduce((sum, leaf) => sum + (leaf instanceof Text ? leaf.data.length : 1), 0);
}

function indexOf(root: HTMLElement, node: Node, offset: number): number {
  const before = document.createRange();
  before.selectNodeContents(root);
  before.setEnd(node, offset);
  return charsIn(before.cloneContents());
}

/** Where the selection is in the element, or null when it is elsewhere. */
export function selectionIn(root: HTMLElement): CharSpan | null {
  const selection = document.getSelection();
  if (!selection?.rangeCount) return null;
  const range = selection.getRangeAt(0);
  if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) return null;
  return { start: indexOf(root, range.startContainer, range.startOffset), end: indexOf(root, range.endContainer, range.endOffset) };
}

function pointAt(root: HTMLElement, index: number): [Node, number] {
  let left = index;
  for (const leaf of leavesOf(root)) {
    if (leaf instanceof Text) {
      if (left <= leaf.data.length) return [leaf, left];
      left -= leaf.data.length;
    } else {
      const parent = leaf.parentNode ?? root;
      if (left === 0) return [parent, Array.prototype.indexOf.call(parent.childNodes, leaf)];
      left -= 1;
    }
  }
  return [root, root.childNodes.length];
}

export function selectSpan(root: HTMLElement, span: CharSpan) {
  const selection = document.getSelection();
  if (!selection) return;
  const range = document.createRange();
  range.setStart(...pointAt(root, span.start));
  range.setEnd(...pointAt(root, span.end));
  selection.removeAllRanges();
  selection.addRange(range);
}

/**
 * Tidies what typing left: a mark a letter has been typed beside is taken out,
 * and words typed straight into the element — after everything was deleted —
 * are put in a span of the look they were meant to have.
 */
export function tidyAfterTyping(root: HTMLElement, look: RunLook) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node as Text;
    for (let at = text.data.indexOf(MARK); at >= 0 && text.data.length > 1; at = text.data.indexOf(MARK)) {
      text.deleteData(at, 1);
    }
  }

  const loose = Array.from(root.childNodes).filter((node) => node instanceof Text && node.data);
  if (!loose.length) return;
  const caret = selectionIn(root);
  for (const node of loose) {
    const span = document.createElement("span");
    paintSpan(span, look);
    root.replaceChild(span, node);
    span.append(node);
  }
  if (caret) selectSpan(root, caret);
}

/** A mark the caret has moved away from holds nothing and goes. */
export function dropStrayMarks(root: HTMLElement) {
  const anchor = document.getSelection()?.anchorNode;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const stray: Text[] = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    // The caret may sit on the mark or just after it, in the span it is in.
    if ((node as Text).data === MARK && node !== anchor && node.parentNode !== anchor) stray.push(node as Text);
  }
  for (const node of stray) {
    const parent = node.parentElement;
    node.remove();
    if (parent && parent !== root && !parent.childNodes.length) parent.remove();
  }
}
