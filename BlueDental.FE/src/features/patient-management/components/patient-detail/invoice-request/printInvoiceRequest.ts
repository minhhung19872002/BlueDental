const PRINTING_CLASS = "ir-printing";

/**
 * Print only the `.ir-sheet` of the open detail dialog: `invoice-request.css`
 * hides everything else while the class is on `<html>`, and the class leaves
 * with the print dialog.
 */
export function printInvoiceRequest() {
  const root = document.documentElement;
  root.classList.add(PRINTING_CLASS);
  const done = () => {
    root.classList.remove(PRINTING_CLASS);
    window.removeEventListener("afterprint", done);
  };
  window.addEventListener("afterprint", done);
  window.print();
}
