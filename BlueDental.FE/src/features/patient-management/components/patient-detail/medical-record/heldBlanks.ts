/**
 * A sheet's blanks held still while a selection runs across them (R-1179).
 *
 * A browser keeps a selection that starts inside an editable element inside
 * it, and every line of a sheet is an editable of its own — so to select over
 * several lines, the blanks stop being editable for as long as that selection
 * lasts. They remember they were, and take writing again once it is over.
 */

const EDITABLE = '[contenteditable="true"]';
const HELD_ATTR = "data-held-editable";

/** Whether a blank takes writing — held still for a selection or not. */
export function isEditableBlank(node: Element): boolean {
  return node.getAttribute("contenteditable") === "true" || node.hasAttribute(HELD_ATTR);
}

export function holdBlanks(doc: Document) {
  doc.querySelectorAll(EDITABLE).forEach((node) => {
    node.setAttribute(HELD_ATTR, "");
    node.setAttribute("contenteditable", "false");
  });
}

export function releaseBlanks(doc: Document) {
  doc.querySelectorAll(`[${HELD_ATTR}]`).forEach((node) => {
    node.removeAttribute(HELD_ATTR);
    node.setAttribute("contenteditable", "true");
  });
}
