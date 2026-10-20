/**
 * Adding and removing rows on a printed form.
 *
 * Three of the nine forms carry a table the clinic may lengthen or shorten:
 * the cost table on "Phiếu tư vấn và xác nhận đồng ý điều trị", and the
 * treatment rows on "Phiếu theo dõi điều trị" and "Phiếu chăm sóc". A row is
 * added by cloning the one under the pointer and renumbering its blanks; it is
 * removed by dropping it and remembering that it is gone.
 *
 * Neither is a new idea of ours — both are the reference's, read off its own
 * markup: a generated row is marked `data-medical-record-generated-row`, and a
 * removed one is remembered under `custom.deleted-table-row.<hash>`, hashed
 * from the id of the row's first blank so the note survives the row itself.
 *
 * Measured on staging 2026-09-09; see docs/clone/pages/patient-detail.md.
 */

import { FLOW_LINE_ATTR } from "./flowLines";

export const FIELD_SELECTOR = "[data-medical-record-field]";
export const GENERATED_ROW_ATTR = "data-medical-record-generated-row";

const DELETED_ROW_PREFIX = "custom.deleted-table-row.";

/**
 * The note that says where an added row was put: keyed by the added row's first
 * blank, holding the first blank of the row it was added under. Without it a
 * row added mid-table came back at the bottom whenever the sheet was drawn again.
 */
const ROW_AFTER_PREFIX = "custom.row-after.";

/** The three tables that can grow, told apart by what their blanks are called. */
export type RowKind = "treatment-cost" | "treatment-tracking" | "care";

/** Every blank id inside one row, in document order. */
export function fieldIdsIn(row: Element): string[] {
  return Array.from(row.querySelectorAll(FIELD_SELECTOR))
    .map((node) => node.getAttribute("data-medical-record-field"))
    .filter((id): id is string => Boolean(id));
}

/**
 * Which row of the cost table a blank belongs to.
 *
 * The form was drawn before the rows were named, so its first eight rows are
 * still plain `consultation.text.21` … `.44` — three blanks to a row. Rows
 * added since carry the newer `…treatment-cost.row-N.…` names.
 *
 * The form now prints seven of those rows (clinic, 2026-10-16). The eighth
 * keeps its old names when it is added back — see `renumber` — so a sheet
 * written on before the change still finds its eighth line.
 */
function costRowNumber(id: string): number | null {
  const named = id.match(/^consultation\.treatment-cost\.row-(\d+)\./);
  if (named) return Number(named[1]);

  const numbered = id.match(/^consultation\.text\.(\d+)$/);
  if (!numbered) return null;
  const at = Number(numbered[1]);
  if (at < 21 || at > 44) return null;
  return Math.floor((at - 21) / 3) + 1;
}

function trackingRowNumber(id: string): number | null {
  const match = id.match(/^treatment-tracking\.page-\d+\.row-(\d+)\./);
  return match ? Number(match[1]) : null;
}

function careRowNumber(id: string): number | null {
  const match = id.match(/^care\.row-(\d+)\./);
  return match ? Number(match[1]) : null;
}

/** Which row of any of the three tables a blank belongs to. */
function anyRowNumber(id: string): number {
  return costRowNumber(id) ?? trackingRowNumber(id) ?? careRowNumber(id) ?? 0;
}

function rowNumberOf(kind: RowKind, id: string): number | null {
  if (kind === "treatment-cost") return costRowNumber(id);
  if (kind === "treatment-tracking") return trackingRowNumber(id);
  return careRowNumber(id);
}

/** Which of the three tables a row belongs to, or none. */
export function rowKindOf(row: Element): RowKind | null {
  const [first] = fieldIdsIn(row);
  if (!first) return null;
  if (costRowNumber(first)) return "treatment-cost";
  if (trackingRowNumber(first)) return "treatment-tracking";
  if (careRowNumber(first)) return "care";
  return null;
}

export function rowsOfKind(root: ParentNode, kind: RowKind): HTMLTableRowElement[] {
  return Array.from(root.querySelectorAll<HTMLTableRowElement>("tbody > tr")).filter(
    (row) => rowKindOf(row) === kind,
  );
}

function highestRowNumber(root: ParentNode, kind: RowKind): number {
  return rowsOfKind(root, kind).reduce((highest, row) => {
    const [first] = fieldIdsIn(row);
    const at = first ? rowNumberOf(kind, first) ?? 0 : 0;
    return Math.max(highest, at);
  }, 0);
}

/** The reference's own hash: a 32-bit rolling multiply, printed in base 36. */
function hash(value: string): string {
  let acc = 0;
  for (let at = 0; at < value.length; at += 1) acc = (acc * 31 + value.charCodeAt(at)) | 0;
  return (acc >>> 0).toString(36);
}

/**
 * The note that says a row is gone.
 *
 * Keyed off the row's first blank rather than its position, so inserting a row
 * above it later does not resurrect it. A row with no blanks has no note, and
 * so cannot be removed — those are the printed headers.
 */
export function deletedRowKey(row: Element): string {
  const [first] = fieldIdsIn(row);
  return first ? `${DELETED_ROW_PREFIX}${hash(first)}` : "";
}

export function isDeletedRowKey(key: string): boolean {
  return key.startsWith(DELETED_ROW_PREFIX);
}

/** What the blanks of a cost row are called, in the order they are drawn. */
const COST_ROW_FIELDS = ["serial", "service", "amount"];

/** The cost rows that were printed with plain `consultation.text.N` blanks. */
const LEGACY_COST_ROWS = 8;
const LEGACY_COST_FIRST_FIELD = 21;

function renumber(kind: RowKind, id: string, row: number, at: number): string {
  if (kind === "treatment-cost") {
    if (row <= LEGACY_COST_ROWS) {
      return `consultation.text.${LEGACY_COST_FIRST_FIELD + (row - 1) * COST_ROW_FIELDS.length + at}`;
    }
    const part = COST_ROW_FIELDS[at] ?? `field-${at + 1}`;
    return `consultation.treatment-cost.row-${row}.${part}`;
  }
  if (kind === "treatment-tracking") return id.replace(/\.row-\d+\./, `.row-${row}.`);
  return id.replace(/^care\.row-\d+\./, `care.row-${row}.`);
}

/** The serial, service and amount blanks of cost row `row` (from 1), as a sheet names them. */
export function costRowFieldIds(row: number): string[] {
  return COST_ROW_FIELDS.map((_, at) => renumber("treatment-cost", "", row, at));
}

/**
 * Puts a fresh, empty copy of `row` after it.
 *
 * The copy keeps the row's cells and borders — it is the same printed row — but
 * its blanks are renumbered past the highest row already there and emptied, and
 * they stop asking the record for anything: a second cost line is not a second
 * patient.
 */
export function addRowAfter(
  root: ParentNode,
  row: HTMLTableRowElement,
  { remember = true }: { remember?: boolean } = {},
): HTMLTableRowElement | null {
  const kind = rowKindOf(row);
  if (!kind) return null;

  const copy = row.cloneNode(true) as HTMLTableRowElement;
  // Lines added inside a cell with Enter belong to that row, not to its copy.
  copy.querySelectorAll(`p[${GENERATED_ROW_ATTR}]`).forEach((line) => line.remove());
  // So are the lines a long blank of that row flowed onto.
  copy.querySelectorAll(`p[${FLOW_LINE_ATTR}]`).forEach((line) => line.remove());
  const next = highestRowNumber(root, kind) + 1;
  const blanks = Array.from(copy.querySelectorAll(FIELD_SELECTOR));
  if (blanks.length === 0) return null;

  blanks.forEach((blank, at) => {
    const id = blank.getAttribute("data-medical-record-field");
    if (!id) return;
    blank.setAttribute("data-medical-record-field", renumber(kind, id, next, at));
    blank.removeAttribute("data-field-source");
    blank.removeAttribute("data-medical-record-suggested");
    if (blank instanceof HTMLInputElement || blank.tagName === "INPUT") {
      (blank as HTMLInputElement).checked = false;
      blank.removeAttribute("checked");
    } else {
      blank.textContent = "";
    }
  });

  copy.setAttribute(GENERATED_ROW_ATTR, "true");
  row.insertAdjacentElement("afterend", copy);

  // Where it went, so it comes back there; not when the sheet is only redrawn.
  const [first] = fieldIdsIn(copy);
  const [anchor] = fieldIdsIn(row);
  if (remember && first && anchor) keepNote(root, row, `${ROW_AFTER_PREFIX}${first}`, anchor);
  return copy;
}

/**
 * A note is a hidden blank beside the table: read back with every other blank,
 * it travels the same path as a typed word. Drawn again with the sheet, so the
 * next save still carries it.
 */
function keepNote(root: ParentNode, near: Element, key: string, value: string) {
  if (root.querySelector(`[data-medical-record-field="${key}"]`)) return;
  const note = near.ownerDocument.createElement("span");
  note.hidden = true;
  note.setAttribute("data-medical-record-field", key);
  note.textContent = value;
  (near.closest("table") ?? near).insertAdjacentElement("afterend", note);
}

function rowStartingWith(root: ParentNode, id: string): HTMLTableRowElement | undefined {
  return Array.from(root.querySelectorAll<HTMLTableRowElement>("tbody > tr")).find(
    (row) => fieldIdsIn(row)[0] === id,
  );
}

/**
 * Drops `row` and leaves the note that says so.
 *
 * The note is a hidden blank rather than a value handed back through React:
 * everything else on the sheet is read back off the document, and this way the
 * removal travels the same path as a typed word.
 */
export function deleteRow(doc: Document, row: HTMLTableRowElement): boolean {
  const key = deletedRowKey(row);
  if (!key) return false;

  keepNote(doc, row, key, "true");
  row.remove();
  return true;
}

/**
 * Brings a freshly drawn form back to the shape it was saved in: the rows that
 * were added are added again, and the rows that were removed are removed.
 *
 * Growing comes first so that a row added and later removed is recreated and
 * then dropped, rather than leaving a gap in the numbering.
 */
export function applyStoredRows(root: ParentNode, stored: Record<string, unknown>) {
  const kinds: RowKind[] = ["treatment-cost", "treatment-tracking", "care"];

  for (const kind of kinds) {
    const rows = rowsOfKind(root, kind);
    if (rows.length === 0) continue;

    const wanted = Object.keys(stored).reduce((highest, id) => {
      const at = rowNumberOf(kind, id);
      return at === null ? highest : Math.max(highest, at);
    }, 0);

    // Clone from the last row each time, so the copy keeps the table's shape.
    for (let count = rows.length; count < wanted; count += 1) {
      const last = rowsOfKind(root, kind).at(-1);
      if (!last || !addRowAfter(root, last, { remember: false })) break;
    }
  }

  // Each added row back under the row it was added under — oldest first, so a
  // row added under an added row finds that one already in place.
  const placed = Object.entries(stored)
    .filter(([key, anchor]) => key.startsWith(ROW_AFTER_PREFIX) && typeof anchor === "string")
    .map(([key, anchor]) => ({ key, id: key.slice(ROW_AFTER_PREFIX.length), anchor: String(anchor) }))
    .sort((a, b) => anyRowNumber(a.id) - anyRowNumber(b.id));
  for (const { key, id, anchor } of placed) {
    const row = rowStartingWith(root, id);
    const under = rowStartingWith(root, anchor);
    if (row && under && row !== under) under.insertAdjacentElement("afterend", row);
    const near = row ?? under;
    if (near) keepNote(root, near, key, anchor);
  }

  for (const [key, value] of Object.entries(stored)) {
    if (!isDeletedRowKey(key)) continue;
    if (value !== true && value !== "true") continue;
    for (const row of Array.from(root.querySelectorAll<HTMLTableRowElement>("tbody > tr"))) {
      if (deletedRowKey(row) === key) {
        keepNote(root, row, key, "true");
        row.remove();
        break;
      }
    }
  }
}
