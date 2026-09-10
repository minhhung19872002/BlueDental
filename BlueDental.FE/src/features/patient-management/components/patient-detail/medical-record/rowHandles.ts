import { addRowAfter, deleteRow, deletedRowKey, rowKindOf } from "./rowEditing";

/**
 * The `+` and `−` that appear on a table row under the pointer.
 *
 * They live inside the sheet's own document, not in the app: the rows are in
 * there, and a button positioned from outside would drift the moment the sheet
 * scrolled or the zoom changed. Both are plain buttons the reference styles
 * inline, and both are `position: fixed` so they sit against the row wherever
 * it happens to be.
 *
 * Measured on staging 2026-09-09; see docs/clone/pages/patient-detail.md.
 */

export interface RowHandleOptions {
  /** May rows be removed on this form? */
  canDelete: boolean;
  /** May rows be added on this form? */
  canAdd: boolean;
  /** Called after the table changes, so the frame can be re-measured. */
  onChanged: () => void;
}

const BASE_STYLE =
  "position:fixed;z-index:20;display:none;align-items:center;justify-content:center;" +
  "width:20px;height:20px;border:0;border-radius:9999px;color:#fff;" +
  "font:700 18px/1 sans-serif;cursor:pointer;box-shadow:0 1px 3px rgba(0,0,0,.25)";

function makeHandle(doc: Document, glyph: string, label: string, background: string) {
  const button = doc.createElement("button");
  button.type = "button";
  button.textContent = glyph;
  button.setAttribute("aria-label", label);
  button.title = label;
  button.style.cssText = `${BASE_STYLE};background:${background}`;
  doc.body.append(button);
  return button;
}

/**
 * How far past a row's right edge the pointer may travel and still be counted
 * as being on that row.
 *
 * `+` sits at `right + 4` — off the row entirely, as the reference places it —
 * so reaching it means crossing a few pixels of nothing. This is what makes
 * that crossing safe; it has to clear the gap and the 20px button.
 */
const REACH = 44;

/**
 * One hover handle: it follows whichever row the pointer is over, as long as
 * `wants` accepts that row, and `act` is what pressing it does.
 */
function attachHandle(
  doc: Document,
  button: HTMLButtonElement,
  place: (rect: DOMRect) => { left: number; top: number },
  wants: (row: HTMLTableRowElement) => boolean,
  act: (row: HTMLTableRowElement) => void,
): () => void {
  let over: HTMLTableRowElement | null = null;

  const hide = () => {
    over = null;
    button.style.display = "none";
  };

  const show = (row: HTMLTableRowElement) => {
    if (!wants(row)) return hide();
    const { left, top } = place(row.getBoundingClientRect());
    over = row;
    button.style.left = `${Math.max(4, left)}px`;
    button.style.top = `${Math.max(4, top)}px`;
    button.style.display = "flex";
  };

  const onOver = (event: Event) => {
    const row = (event.target as Element | null)?.closest<HTMLTableRowElement>("tbody > tr");
    if (row) show(row);
  };

  /** Is the pointer still on the row, on the handle, or on the way between? */
  const withinReach = (x: number, y: number): boolean => {
    if (!over) return false;
    const handle = button.getBoundingClientRect();
    if (x >= handle.left - 2 && x <= handle.right + 2 && y >= handle.top - 2 && y <= handle.bottom + 2) {
      return true;
    }
    const row = over.getBoundingClientRect();
    return x >= row.left && x <= row.right + REACH && y >= row.top && y <= row.bottom;
  };

  /*
   * Hiding is decided by where the pointer *is*, not by which element it just
   * left. `mouseout` fires the moment the row's edge is crossed, and the
   * element on the other side of the 4px gap is the page, not the button — so
   * the handle used to vanish from under a hand that was reaching for it, and
   * `+` could not be clicked at all.
   */
  const onMove = (event: MouseEvent) => {
    if (over && !withinReach(event.clientX, event.clientY)) hide();
  };

  const onClick = (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (over) act(over);
    hide();
  };

  doc.addEventListener("mouseover", onOver, true);
  doc.addEventListener("mousemove", onMove, true);
  // The pointer leaving the sheet altogether reports no further movement, and
  // `mouseleave` is an element's event — the document never gets one.
  doc.documentElement.addEventListener("mouseleave", hide);
  button.addEventListener("click", onClick);

  return () => {
    doc.removeEventListener("mouseover", onOver, true);
    doc.removeEventListener("mousemove", onMove, true);
    doc.documentElement.removeEventListener("mouseleave", hide);
    button.removeEventListener("click", onClick);
    button.remove();
  };
}

/**
 * Puts the handles this form is allowed on the sheet's document, and returns
 * the call that takes them off again.
 */
export function attachRowHandles(doc: Document, options: RowHandleOptions): () => void {
  const detach: Array<() => void> = [];

  if (options.canDelete) {
    const button = makeHandle(doc, "−", "Xóa dòng", "#dc2626");
    detach.push(
      attachHandle(
        doc,
        button,
        // Just inside the row's right edge, so it never collides with `+`.
        (rect) => ({ left: rect.right - 10, top: rect.top + 4 }),
        // A row with no blanks is a printed header, and has nothing to remove.
        (row) => row.parentElement?.tagName === "TBODY" && Boolean(deletedRowKey(row)),
        (row) => {
          if (deleteRow(doc, row)) options.onChanged();
        },
      ),
    );
  }

  if (options.canAdd) {
    const button = makeHandle(doc, "+", "Thêm dòng", "#16a34a");
    detach.push(
      attachHandle(
        doc,
        button,
        (rect) => ({ left: rect.right + 4, top: rect.top + 4 }),
        // Only the three tables that are lists can grow.
        (row) => rowKindOf(row) !== null,
        (row) => {
          if (addRowAfter(doc, row)) options.onChanged();
        },
      ),
    );
  }

  return () => detach.forEach((off) => off());
}
