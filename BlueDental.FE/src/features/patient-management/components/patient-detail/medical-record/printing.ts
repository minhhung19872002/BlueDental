/**
 * Getting a record onto paper.
 *
 * The sheet is an iframe carrying what has been typed into it, so it cannot be
 * cloned into a print container the way the other print dialogs do — moving it
 * reloads it and the typing is gone. It has to print where it already sits.
 *
 * Hiding the rest with `visibility` is not enough either: an invisible box
 * still takes up paper, and the record would print after a page of nothing. So
 * every branch that is not on the path down to a sheet is taken out of the
 * layout for the duration of the print, and put back afterwards.
 */

/** On the body while a record is going to the printer. */
export const PRINTING_CLASS = "mr-printing";

/**
 * How each branch is marked for the duration of the print.
 *
 * An attribute rather than a class: `className` is a rendered prop, so a React
 * update that touches one of these elements writes its own value straight over
 * ours and the branch comes back — measured, with the whole index printing
 * above the record. Nothing renders `data-mr-print`, so nothing overwrites it.
 */
const MARK = "data-mr-print";

/** On each branch that must not take up room on the paper. */
const HIDDEN = "hide";

/**
 * On each branch the sheet hangs from.
 *
 * Hiding the rest is only half of it: what is left standing is the app's own
 * chrome — the shell, the scrolling main, the page, the sheet column — and
 * every one of them is a fixed-height box that clips. A record two and a half
 * pages long came out as **one** page, because the printer paginates what the
 * root actually lays out and the root was capped at the window. So each of
 * those is opened up for the duration of the print.
 */
const PATH = "path";

/** The sheets themselves — a branch holding one is never hidden. */
const SHEET_SELECTOR = ".mr-doc";

function holdsASheet(node: Element): boolean {
  return node.matches(SHEET_SELECTOR) || node.querySelector(SHEET_SELECTOR) !== null;
}

/**
 * Takes everything that is not a sheet out of the layout, opens up what the
 * sheet hangs from, and returns the call that puts both back.
 *
 * Walks down from the body rather than up from a sheet, so that "Toàn bộ" —
 * where several sheets print in one run — keeps all of them.
 */
export function isolateSheetsForPrint(root: ParentNode = document.body): () => void {
  const marked: Element[] = [];

  const mark = (node: Element, how: string) => {
    node.setAttribute(MARK, how);
    marked.push(node);
  };

  const walk = (parent: ParentNode) => {
    for (const child of Array.from(parent.children)) {
      if (child.matches(SHEET_SELECTOR)) continue;
      if (holdsASheet(child)) {
        mark(child, PATH);
        walk(child);
        continue;
      }
      mark(child, HIDDEN);
    }
  };

  walk(root);
  document.body.classList.add(PRINTING_CLASS);

  return () => {
    document.body.classList.remove(PRINTING_CLASS);
    for (const node of marked) node.removeAttribute(MARK);
    marked.length = 0;
  };
}
