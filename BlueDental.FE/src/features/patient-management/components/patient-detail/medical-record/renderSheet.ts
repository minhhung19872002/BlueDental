import { SHEET_CSS, SHEET_PAGE_CSS } from "./sheetCss";
import type { FieldValues } from "./fieldValues";
import { applyStoredRows } from "./rowEditing";

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

    if (node instanceof HTMLInputElement && node.type === "checkbox") {
      if (typeof value === "boolean") node.checked = value;
      // A checkbox reflects `checked` as a property; the attribute is what
      // survives serialisation back to the iframe's markup.
      if (node.checked) node.setAttribute("checked", "checked");
      else node.removeAttribute("checked");
      node.disabled = !options.editable;
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

/** The filled body of one record, ready to be dropped into the sheet frame. */
export function renderSheetHtml(template: string, options: RenderOptions): string {
  const parsed = new DOMParser().parseFromString(`<div>${template}</div>`, "text/html");
  const root = parsed.body.firstElementChild;
  if (!root) return "";

  // The rows the clinic added or removed come back before the blanks are
  // filled, so the blanks on a re-added row are filled like any other.
  applyStoredRows(root, options.stored);
  fillFields(root, options);
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
export function sheetDocument(body: string): string {
  return [
    "<!DOCTYPE html>",
    '<html lang="vi"><head><meta charset="UTF-8" />',
    "<style>",
    SHEET_CSS,
    SHEET_PAGE_CSS,
    "</style></head>",
    `<body><main class="nfc-tpl">${body}</main></body></html>`,
  ].join("");
}
