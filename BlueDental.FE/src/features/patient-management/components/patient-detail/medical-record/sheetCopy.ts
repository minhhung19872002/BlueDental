import { FLOW_BREAK, FLOW_LINE_ATTR } from "./flowLines";

/**
 * What Ctrl+C puts on the clipboard from a sheet (clinic, 2026-11-09, R-1179):
 * the text as it was written, not as the paper broke it.
 *
 *   - a line a long blank flowed onto only because the width ran out joins the
 *     line before it with a space, so a summary pastes as one paragraph;
 *   - a line the writer broke — Enter, or a blank of its own under a label —
 *     keeps its break;
 *   - the form's printed words come along only where the selection took them,
 *     and runs of empty dotted lines fold into one empty line.
 *
 * Plain text only, so a copy pasted back into a blank stays words, not markup.
 */

type Break = " " | "\t" | "\n";

/** A stronger break wins over a weaker one asked for at the same place. */
const BREAK_WEIGHT: Record<Break, number> = { " ": 1, "\t": 2, "\n": 3 };

const LINE_TAGS = new Set(["P", "H1", "H2", "H3", "H4", "H5", "H6", "LI", "DIV", "TR", "TABLE"]);
const CELL_TAGS = new Set(["TD", "TH"]);
const SKIPPED_TAGS = new Set(["INPUT", "BUTTON", "SCRIPT", "STYLE", "SVG", "CANVAS", "IMG"]);
const WRITING_SELECTOR = '[data-field-type="text"]';

/** A line a blank flowed onto because its width ran out, not because the text broke. */
function isSoftFlowLine(element: Element): boolean {
  if (!element.hasAttribute(FLOW_LINE_ATTR)) return false;
  return element.querySelector(`[${FLOW_BREAK}]`)?.getAttribute(FLOW_BREAK) === "soft";
}

class TextWriter {
  private text = "";
  private pending: Break | null = null;

  ask(kind: Break) {
    if (!this.pending || BREAK_WEIGHT[kind] > BREAK_WEIGHT[this.pending]) this.pending = kind;
  }

  write(words: string) {
    if (!words) return;
    if (this.pending && this.text) {
      // A space break needs no second space where the words already have one.
      if (!(this.pending === " " && /\s$/.test(this.text))) this.text += this.pending;
    }
    this.pending = null;
    this.text += words;
  }

  done(): string {
    return this.text
      .split("\n")
      .map((line) => line.replace(/^ +| +$/g, ""))
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }
}

/*
 * The sheet lives in its own frame, a realm of its own: its nodes are told
 * apart by `nodeType`, never by `instanceof` against this window's classes.
 */
function isElement(node: Node): node is Element {
  return node.nodeType === Node.ELEMENT_NODE;
}

function visitElement(element: Element, writer: TextWriter, inWriting: boolean) {
  const tag = element.tagName.toUpperCase();
  if (SKIPPED_TAGS.has(tag)) return;
  if (tag === "BR") {
    writer.ask("\n");
    return;
  }
  if (LINE_TAGS.has(tag)) writer.ask(isSoftFlowLine(element) ? " " : "\n");
  if (CELL_TAGS.has(tag)) writer.ask("\t");
  const writing = inWriting || element.matches(WRITING_SELECTOR);
  element.childNodes.forEach((child) => visit(child, writer, writing));
}

function visit(node: Node, writer: TextWriter, inWriting: boolean) {
  if (node.nodeType === Node.TEXT_NODE) {
    const words = node.textContent ?? "";
    // The template's own indentation is not text; what was written is kept as it is.
    writer.write(inWriting ? words : words.replace(/\s+/g, " "));
    return;
  }
  if (isElement(node)) {
    visitElement(node, writer, inWriting);
    return;
  }
  if (node.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
    node.childNodes.forEach((child) => visit(child, writer, inWriting));
  }
}

/** The clipboard's text for a selection on a sheet. */
export function copiedText(range: Range): string {
  const writer = new TextWriter();
  // The fragment starts under the selection's common ancestor; inside one blank, all of it is writing.
  const common = range.commonAncestorContainer;
  const holder = isElement(common) ? common : common.parentElement;
  visit(range.cloneContents(), writer, Boolean(holder?.closest(WRITING_SELECTOR)));
  return writer.done();
}
