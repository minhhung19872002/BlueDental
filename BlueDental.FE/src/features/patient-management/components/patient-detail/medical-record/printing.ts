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

/** On each branch that must not take up room on the paper. */
const HIDDEN_CLASS = "mr-print-hide";

/** The sheets themselves — a branch holding one is never hidden. */
const SHEET_SELECTOR = ".mr-doc";

function holdsASheet(node: Element): boolean {
  return node.matches(SHEET_SELECTOR) || node.querySelector(SHEET_SELECTOR) !== null;
}

/**
 * Takes everything that is not a sheet out of the layout, and returns the call
 * that puts it back.
 *
 * Walks up from the body rather than down from a sheet, so that "Toàn bộ" —
 * where several sheets print in one run — keeps all of them.
 */
export function isolateSheetsForPrint(root: ParentNode = document.body): () => void {
  const hidden: Element[] = [];

  const walk = (parent: ParentNode) => {
    for (const child of Array.from(parent.children)) {
      if (child.matches(SHEET_SELECTOR)) continue;
      if (holdsASheet(child)) {
        walk(child);
        continue;
      }
      child.classList.add(HIDDEN_CLASS);
      hidden.push(child);
    }
  };

  walk(root);
  document.body.classList.add(PRINTING_CLASS);

  return () => {
    document.body.classList.remove(PRINTING_CLASS);
    for (const node of hidden) node.classList.remove(HIDDEN_CLASS);
    hidden.length = 0;
  };
}
