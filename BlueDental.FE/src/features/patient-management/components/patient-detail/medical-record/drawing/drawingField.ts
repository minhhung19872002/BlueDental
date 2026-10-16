import { t } from "@/lib/i18n";

/**
 * A blank that holds a picture instead of words — "Lược đồ phẫu thuật/thủ
 * thuật" on Phiếu phẫu thuật/thủ thuật, where the doctor sketches the
 * operation.
 *
 * It is a blank like any other — `data-medical-record-field`, stored under its
 * id — with `data-field-type="drawing"`. What it holds is the picture's source:
 * the link to a saved drawing, or the PNG itself while the drawing is new and
 * the sheet has not been saved. Saving swaps the second for the first; see
 * `uploadPendingDrawings`.
 *
 * Self-developed: the reference leaves this cell empty for the pen. See
 * docs/clone/pages/patient-detail.md §Bệnh án.
 */

export const DRAWING_FIELD_TYPE = "drawing";

const SOURCE_ATTR = "data-drawing-src";
const ACTION_ATTR = "data-drawing-action";

export type DrawingAction = "edit" | "delete";

const SAVED_DRAWING = /^\/api\/v1\/app\/patient-medical-records\/[0-9a-f-]{36}\/drawings\/[0-9a-f-]{36}$/i;
const UNSAVED_DRAWING = /^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/;

/**
 * Whether a stored value may be shown as the drawing. Anything else — a typed
 * word, a link elsewhere — is dropped rather than handed to `<img src>`: the
 * value comes from the sheet's content, and the sheet is not a place to load
 * pictures from the internet.
 */
export function isDrawingSource(value: unknown): value is string {
  return typeof value === "string" && (SAVED_DRAWING.test(value) || UNSAVED_DRAWING.test(value));
}

export function isUnsavedDrawing(value: string): boolean {
  return UNSAVED_DRAWING.test(value);
}

export function isDrawingField(node: Element): boolean {
  return node.getAttribute("data-field-type") === DRAWING_FIELD_TYPE;
}

/** What the blank holds now, read back off the sheet. Empty when nothing is drawn. */
export function drawingOf(node: Element): string {
  return node.getAttribute(SOURCE_ATTR) ?? "";
}

/** Lucide's pencil and trash-2, drawn in the sheet's own document. */
const ACTION_ICON: Record<DrawingAction, readonly string[]> = {
  edit: [
    "M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z",
    "m15 5 4 4",
  ],
  delete: [
    "M3 6h18",
    "M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6",
    "M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2",
    "M10 11v6",
    "M14 11v6",
  ],
};

const SVG_NS = "http://www.w3.org/2000/svg";

function actionIcon(doc: Document, action: DrawingAction): SVGSVGElement {
  const svg = doc.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  for (const d of ACTION_ICON[action]) {
    const path = doc.createElementNS(SVG_NS, "path");
    path.setAttribute("d", d);
    svg.append(path);
  }
  return svg;
}

/**
 * An icon button; what it does is its accessible name and the tooltip shown
 * on hover (clinic, 2026-10-16). The tooltip is the sheet's own CSS — the
 * sheet is a separate document, out of reach of the app's Tooltip.
 */
function actionButton(doc: Document, action: DrawingAction, label: string): HTMLButtonElement {
  const button = doc.createElement("button");
  button.type = "button";
  button.className = `nfc-medical-record-drawing-btn nfc-medical-record-drawing-btn--${action}`;
  button.setAttribute(ACTION_ATTR, action);
  button.setAttribute("aria-label", label);
  button.setAttribute("data-tooltip", label);
  button.append(actionIcon(doc, action));
  return button;
}

/**
 * Draws the blank: the picture when there is one, and — on a sheet being
 * written on — the buttons above it. The buttons are the sheet's own, inside
 * its document, so they sit on the cell at every zoom; they never print.
 */
export function showDrawing(node: Element, value: unknown, editable: boolean): void {
  const doc = node.ownerDocument;
  const source = isDrawingSource(value) ? value : "";

  node.replaceChildren();
  if (source) node.setAttribute(SOURCE_ATTR, source);
  else node.removeAttribute(SOURCE_ATTR);

  if (source) {
    const picture = doc.createElement("img");
    picture.className = "nfc-medical-record-drawing-img";
    picture.alt = t("Patient:MedRecord:Drawing");
    picture.src = source;
    node.append(picture);
  }

  if (!editable) return;

  const tools = doc.createElement("span");
  tools.className = "nfc-medical-record-drawing-tools";
  tools.append(
    actionButton(doc, "edit", source ? t("Patient:MedRecord:EditDrawing") : t("Patient:MedRecord:Draw")),
  );
  if (source) tools.append(actionButton(doc, "delete", t("Patient:MedRecord:DeleteDrawing")));
  node.append(tools);
}

/**
 * Listens for the drawing buttons on an open sheet, and returns the call that
 * stops listening. A double click on the picture opens it as well.
 */
export function attachDrawingControls(
  doc: Document,
  onRequest: (fieldId: string, action: DrawingAction, source: string) => void,
): () => void {
  const fieldOf = (target: EventTarget | null) => {
    const node = (target as Element | null)?.closest?.(`[data-field-type="${DRAWING_FIELD_TYPE}"]`);
    const id = node?.getAttribute("data-medical-record-field");
    return node && id ? { node, id } : null;
  };

  const onClick = (event: MouseEvent) => {
    const button = (event.target as Element | null)?.closest?.(`[${ACTION_ATTR}]`);
    const field = fieldOf(button ?? null);
    if (!button || !field) return;
    event.preventDefault();
    const action = button.getAttribute(ACTION_ATTR) === "delete" ? "delete" : "edit";
    onRequest(field.id, action, drawingOf(field.node));
  };

  const onDoubleClick = (event: MouseEvent) => {
    const field = fieldOf(event.target);
    // Only where the buttons are — a read-only sheet has none.
    if (!field || !field.node.querySelector(`[${ACTION_ATTR}]`)) return;
    onRequest(field.id, "edit", drawingOf(field.node));
  };

  doc.addEventListener("click", onClick);
  doc.addEventListener("dblclick", onDoubleClick);
  return () => {
    doc.removeEventListener("click", onClick);
    doc.removeEventListener("dblclick", onDoubleClick);
  };
}
