/**
 * A blank whose text runs past its line goes on to dotted lines of its own
 * under it, as the paper form is written, rather than wrapping inside one tall
 * box (clinic, 2026-10-19). In a table cell the lines stay in the cell.
 *
 * Only how the sheet is drawn: the blank still holds the one value. The lines
 * it flowed onto carry no field id of their own — they point back at it — so
 * reading the sheet back joins them again (`flowedText`), and nothing stored
 * or answered by the record changes shape. Drawn once the sheet is laid out,
 * because only then is a blank's width known.
 */

const FIELD_SELECTOR = "[data-medical-record-field]";
const TEXT_BLANK_SELECTOR = `${FIELD_SELECTOR}[data-field-type="text"]`;
const BLOCK_SELECTOR = "p, h1, h2, h3, h4, li";

/** On a flowed line's blank: the id of the blank it continues. */
const FLOW_OF = "data-flow-of";
/** "hard" where the text itself broke the line, "soft" where only the width did. */
const FLOW_BREAK = "data-flow-break";
/** On the block a flowed line sits in — what a cloned table row must leave behind. */
export const FLOW_LINE_ATTR = "data-flow-line";

const COPIED_BLOCK_ATTRIBUTES = ["style", "data-block-align"];
const COPIED_ATTRIBUTES = [
  "class",
  "data-field-type",
  "data-field-width",
  "data-field-full-width",
  "data-placeholder",
  "style",
];

interface Line {
  text: string;
  hard: boolean;
}

function flowedLines(field: Element): Element[] {
  const id = field.getAttribute("data-medical-record-field");
  if (!id) return [];
  return Array.from(field.ownerDocument.querySelectorAll(`[${FLOW_OF}="${CSS.escape(id)}"]`));
}

/** The blank's whole text: its own line and the lines it flowed onto, joined as they broke. */
export function flowedText(field: Element): string {
  return flowedLines(field).reduce(
    (text, line) => `${text}${line.getAttribute(FLOW_BREAK) === "hard" ? "\n" : " "}${line.textContent ?? ""}`,
    field.textContent ?? "",
  );
}

/** Whether `node` is the blank or one of the lines it flowed onto — where a caret may be. */
export function isPartOf(field: Element, node: Element | null): boolean {
  if (!node) return false;
  return node === field || node.getAttribute(FLOW_OF) === field.getAttribute("data-medical-record-field");
}

/** Greedy word wrap of each of the text's own lines to `width`, in the blank's type. */
function wrap(text: string, width: number, context: CanvasRenderingContext2D): Line[] {
  const lines: Line[] = [];
  text.split("\n").forEach((part, at) => {
    let line = "";
    let hard = at > 0;
    for (const word of part.split(/ +/)) {
      const next = line ? `${line} ${word}` : word;
      if (line && context.measureText(next).width > width) {
        lines.push({ text: line, hard });
        line = word;
        hard = false;
      } else {
        line = next;
      }
    }
    lines.push({ text: line, hard });
  });
  return lines;
}

function flowLine(field: Element, block: Element, line: Line): HTMLElement {
  const doc = field.ownerDocument;
  const paragraph = doc.createElement("p");
  for (const name of COPIED_BLOCK_ATTRIBUTES) {
    const value = block.getAttribute(name);
    if (value !== null) paragraph.setAttribute(name, value);
  }
  paragraph.setAttribute(FLOW_LINE_ATTR, "true");

  const blank = doc.createElement("span");
  for (const name of COPIED_ATTRIBUTES) {
    const value = field.getAttribute(name);
    if (value !== null) blank.setAttribute(name, value);
  }
  if (field.getAttribute("contenteditable") === "true") blank.setAttribute("contenteditable", "true");
  blank.setAttribute(FLOW_OF, field.getAttribute("data-medical-record-field") ?? "");
  blank.setAttribute(FLOW_BREAK, line.hard ? "hard" : "soft");
  blank.textContent = line.text;

  paragraph.append(blank);
  return paragraph;
}

/** Breaks one blank's text over lines of its own, if it wraps or breaks at all. */
function flow(field: Element, context: CanvasRenderingContext2D) {
  const text = field.textContent ?? "";
  const block = field.closest(BLOCK_SELECTOR);
  if (!text.trim() || !block || field.children.length > 0) return;

  const view = field.ownerDocument.defaultView;
  const style = view?.getComputedStyle(field);
  if (!style) return;
  const lineHeight = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.2;
  if (!text.includes("\n") && field.getBoundingClientRect().height < lineHeight * 1.6) return;

  const width = field.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight) - 2;
  if (width <= 0) return;
  context.font = style.font || `${style.fontSize} ${style.fontFamily}`;

  const [first, ...rest] = wrap(text, width, context);
  if (rest.length === 0) return;

  field.textContent = first.text;
  let after: Element = block;
  for (const line of rest) {
    const next = flowLine(field, block, line);
    after.insertAdjacentElement("afterend", next);
    after = next;
  }
}

/** Takes back the lines a blank flowed onto, and writes `text` into it whole. */
function unflow(field: Element, text: string) {
  for (const line of flowedLines(field)) line.closest(`[${FLOW_LINE_ATTR}]`)?.remove();
  field.textContent = text;
}

function contextFor(doc: Document): CanvasRenderingContext2D | null {
  return doc.createElement("canvas").getContext("2d");
}

/** Flows every blank on the laid-out sheet whose text runs past its line. */
export function flowLongBlanks(doc: Document) {
  const context = contextFor(doc);
  if (!context) return;
  doc.querySelectorAll(TEXT_BLANK_SELECTOR).forEach((field) => flow(field, context));
}

/** Writes a value from outside the sheet into a blank, flowing it again. */
export function writeFlowed(field: Element, text: string) {
  unflow(field, text);
  const context = contextFor(field.ownerDocument);
  if (context) flow(field, context);
}
