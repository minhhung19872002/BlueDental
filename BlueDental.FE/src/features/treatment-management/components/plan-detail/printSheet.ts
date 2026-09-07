const PRINTING_CLASS = "pdt-printing";

/**
 * Print only the `.pdt-sheet` of the open dialog: `plan-detail.css` hides
 * everything else on the page while the class is on `<html>`, and the class
 * leaves with the print dialog.
 */
export function printSheet() {
  const root = document.documentElement;
  root.classList.add(PRINTING_CLASS);
  const done = () => {
    root.classList.remove(PRINTING_CLASS);
    window.removeEventListener("afterprint", done);
  };
  window.addEventListener("afterprint", done);
  window.print();
}
