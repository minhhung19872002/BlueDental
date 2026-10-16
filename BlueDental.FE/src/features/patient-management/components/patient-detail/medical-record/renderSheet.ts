import { SHEET_CSS, SHEET_PAGE_CSS } from "./sheetCss";
import type { FieldValues } from "./fieldValues";
import { applyStoredRows } from "./rowEditing";
import { applyStoredLines } from "./lineEditing";
import { isDrawingField, showDrawing } from "./drawing/drawingField";
import {
  isMaterialField,
  legacyPicks,
  materialCatalogKey,
  materialKindOf,
  parseMaterials,
  parsePicked,
  showMaterials,
} from "./materials/materialField";
import { applySections } from "./sheetSections";

/**
 * Turning a blank form into the sheet on screen.
 *
 * The template is filled through the DOM rather than by rewriting its text: a
 * record carries eight hundred blanks and a stray `<` in a patient's note would
 * otherwise corrupt the page it is printed on.
 */

export interface RenderOptions {
  /** The facts a blank falls back to — the record and the letterhead. */
  auto: FieldValues;
  /** What has been written on this sheet. Wins over `auto`. */
  stored: FieldValues;
  /** Cleared for the read-only views: "Toàn bộ", and the copy sent to print. */
  editable: boolean;
}

const FIELD_SELECTOR = "[data-medical-record-field]";
const TOKEN = /\{\{\s*([a-zA-Z0-9._-]{1,100})\s*\}\}/g;

/**
 * "Số ngoại trú" on Phiếu theo dõi điều trị asks for the patient's code, and
 * the reference takes that back: the outpatient number is the clinic's own
 * running number, not the record's. It strips the blank's `data-field-source`
 * rather than the blank, so the box is still there to write in.
 */
const UNBOUND_OUTPATIENT_NUMBER = /^treatment-tracking\.page-\d+\.patient\.code$/;

function has(values: FieldValues, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(values, key);
}

/** A blank is answered by its own id first, then by the fact it asked for. */
function valueOf(id: string, source: string, options: RenderOptions): unknown {
  if (has(options.stored, id)) return options.stored[id];
  if (has(options.auto, id)) return options.auto[id];
  return options.auto[source];
}

function fillFields(root: ParentNode, options: RenderOptions) {
  root.querySelectorAll(FIELD_SELECTOR).forEach((node) => {
    const id = node.getAttribute("data-medical-record-field");
    if (!id) return;
    if (UNBOUND_OUTPATIENT_NUMBER.test(id)) node.removeAttribute("data-field-source");
    const source = node.getAttribute("data-field-source") ?? id;
    const value = valueOf(id, source, options);

    if (isDrawingField(node)) {
      showDrawing(node, value, options.editable);
      return;
    }

    // "Loại" on mẫu 5: the types of its kind from Danh mục, ticked as stored —
    // or, on a sheet from before, as the old fixed boxes were.
    if (isMaterialField(node)) {
      const picks = has(options.stored, id) ? parsePicked(options.stored[id]) : legacyPicks(id, options.stored);
      const catalog = parseMaterials(options.auto[materialCatalogKey(materialKindOf(node))]);
      showMaterials(node, catalog, picks, options.editable);
      return;
    }

    if (node instanceof HTMLInputElement && node.type === "checkbox") {
      if (typeof value === "boolean") node.checked = value;
      // A checkbox reflects `checked` as a property; the attribute is what
      // survives serialisation back to the iframe's markup.
      if (node.checked) node.setAttribute("checked", "checked");
      else node.removeAttribute("checked");
      /*
       * Never `disabled`: a disabled box is greyed by the browser, tick and
       * all, so every sheet in "Toàn bộ" lost the reference's blue — on screen
       * and on paper. A read-only sheet is held still by `pointer-events`
       * instead; see the `[data-readonly]` rule in the sheet's stylesheet.
       *
       * (The reference locks nothing here at all — in "Toàn bộ" its sheets stay
       * editable. Ours stay read-only because "Lưu" only saves the open sheet.)
       */
      return;
    }

    if (typeof value === "string") node.textContent = value;
    if (options.editable) node.setAttribute("contenteditable", "true");
    else node.removeAttribute("contenteditable");
  });
}

/**
 * `{{branch.name}}` and the like, replaced in text only — an attribute is never
 * a place the templates put one, and rewriting one would break the markup.
 */
function fillTokens(root: Node, values: FieldValues) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const texts: Text[] = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node.nodeValue?.includes("{{")) texts.push(node as Text);
  }

  for (const text of texts) {
    text.nodeValue = (text.nodeValue ?? "").replace(TOKEN, (_, name: string) => {
      const value = values[name];
      if (typeof value === "string") return value;
      if (typeof value === "boolean") return value ? "☑" : "☐";
      return "";
    });
  }
}

/**
 * Tables that only lay the page out: no cell borders, so a blank in one still
 * needs its dotted line on paper. Every other table is a grid, whose cells
 * already say where to write.
 */
const LAYOUT_SECTIONS = new Set(["layout", "general-exam", "signature", "outpatient-summary-title"]);

function isGrid(table: Element): boolean {
  if (table.hasAttribute("data-borderless") || table.hasAttribute("data-cover")) return false;
  if (table.hasAttribute("data-record-page")) return false;
  return !LAYOUT_SECTIONS.has(table.getAttribute("data-record-section") ?? "");
}

/** Marks the cells of real grids, so the stylesheet can print their blanks without the dotted line. */
function markGridCells(root: Element) {
  root.querySelectorAll("td, th").forEach((cell) => {
    const table = cell.closest("table");
    if (table && isGrid(table)) cell.setAttribute("data-grid-cell", "true");
  });
}

/**
 * The space the forms were drawn with, taken in (clinic, 2026-10-16: "gọn như
 * mẫu 5"): a paragraph holding nothing — no words, blanks, boxes or pictures —
 * is only a gap, and is marked so the stylesheet can close it up; a title's
 * (or a section heading's) leading and trailing line breaks go. The cover is left as drawn: its frame
 * is a fixed page and the title sits in it by those gaps.
 */
function closeUpGaps(root: Element) {
  root.querySelectorAll("p").forEach((paragraph) => {
    if (paragraph.closest("[data-cover]")) return;
    if ((paragraph.textContent ?? "").trim()) return;
    if (paragraph.querySelector(`${FIELD_SELECTOR}, input, img, svg`)) return;
    paragraph.setAttribute("data-spacer", "true");
  });

  root.querySelectorAll("h1, h2").forEach((title) => {
    if (title.closest("[data-cover]")) return;
    const walker = title.ownerDocument.createTreeWalker(title, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
    const sequence: Node[] = [];
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (node.nodeName === "BR" || (node.nodeType === Node.TEXT_NODE && node.nodeValue?.trim())) sequence.push(node);
    }
    const firstText = sequence.findIndex((node) => node.nodeName !== "BR");
    const lastText = sequence.length - 1 - [...sequence].reverse().findIndex((node) => node.nodeName !== "BR");
    sequence.forEach((node, at) => {
      if (node.nodeName === "BR" && (firstText === -1 || at < firstText || at > lastText)) node.parentNode?.removeChild(node);
    });
  });
}

/** The filled body of one record, ready to be dropped into the sheet frame. */
export function renderSheetHtml(template: string, options: RenderOptions): string {
  const parsed = new DOMParser().parseFromString(`<div>${template}</div>`, "text/html");
  const root = parsed.body.firstElementChild;
  if (!root) return "";

  // The rows the clinic added or removed come back before the blanks are
  // filled, so the blanks on a re-added row are filled like any other.
  applyStoredRows(root, options.stored);
  applyStoredLines(root, options.stored);
  markGridCells(root);
  closeUpGaps(root);
  fillFields(root, options);
  // After the boxes are ticked: the parts that show only for a ticked box.
  applySections(root);
  fillTokens(root, { ...options.auto, ...options.stored });
  return root.innerHTML;
}

/**
 * The whole page the sheet is shown in.
 *
 * Its own document, not a corner of ours: the record is Times New Roman at a
 * fixed 13px on a 210mm page, and BlueDental's stylesheet reaching it would
 * move the layout off the printed original.
 */
export function sheetDocument(body: string, editable = true, form?: number): string {
  // A read-only sheet is marked, not disabled: `disabled` greys a tick box and
  // the reference's blue with it. The stylesheet holds the sheet still.
  const readOnly = editable ? "" : ' data-readonly="true"';
  // Which of the nine forms: each prints at its own type size (sheetCss).
  const formAttr = form ? ` data-form="${form}"` : "";
  return [
    "<!DOCTYPE html>",
    '<html lang="vi"><head><meta charset="UTF-8" />',
    "<style>",
    SHEET_CSS,
    SHEET_PAGE_CSS,
    "</style></head>",
    `<body><main class="nfc-tpl"${formAttr}${readOnly}>${body}</main></body></html>`,
  ].join("");
}
