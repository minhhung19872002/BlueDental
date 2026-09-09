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

export const FIELD_SELECTOR = "[data-medical-record-field]";
export const GENERATED_ROW_ATTR = "data-medical-record-generated-row";

const DELETED_ROW_PREFIX = "custom.deleted-table-row.";

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

function renumber(kind: RowKind, id: string, row: number, at: number): string {
  if (kind === "treatment-cost") {
    const part = COST_ROW_FIELDS[at] ?? `field-${at + 1}`;
    return `consultation.treatment-cost.row-${row}.${part}`;
  }
  if (kind === "treatment-tracking") return id.replace(/\.row-\d+\./, `.row-${row}.`);
  return id.replace(/^care\.row-\d+\./, `care.row-${row}.`);
}

/**
 * Puts a fresh, empty copy of `row` after it.
 *
 * The copy keeps the row's cells and borders — it is the same printed row — but
 * its blanks are renumbered past the highest row already there and emptied, and
 * they stop asking the record for anything: a second cost line is not a second
 * patient.
 */
export function addRowAfter(root: ParentNode, row: HTMLTableRowElement): HTMLTableRowElement | null {
  const kind = rowKindOf(row);
  if (!kind) return null;

  const copy = row.cloneNode(true) as HTMLTableRowElement;
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
  return copy;
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

  if (!doc.querySelector(`[data-medical-record-field="${key}"]`)) {
    const note = doc.createElement("span");
    note.hidden = true;
    note.setAttribute("data-medical-record-field", key);
    note.textContent = "true";
    doc.body.append(note);
  }

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
      if (!last || !addRowAfter(root, last)) break;
    }
  }

  for (const [key, value] of Object.entries(stored)) {
    if (!isDeletedRowKey(key)) continue;
    if (value !== true && value !== "true") continue;
    for (const row of Array.from(root.querySelectorAll<HTMLTableRowElement>("tbody > tr"))) {
      if (deletedRowKey(row) === key) {
        row.remove();
        break;
      }
    }
  }
}
