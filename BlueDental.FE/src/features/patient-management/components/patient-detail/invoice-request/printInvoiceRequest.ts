const PRINTING_CLASS = "ir-printing";
const ROOT_CLASS = "ir-print-root";

/**
 * The BA's paper form is an A5 sheet turned sideways. No page margin: the
 * browser's date / URL header and footer have nowhere to go, and the sheet's
 * own padding is the margin.
 */
const PAGE_RULE = "@page { size: A5 landscape; margin: 0; }";

/**
 * Print only the `.ir-sheet` of the open detail dialog. The sheet is copied out
 * of the modal (whose frame and scroll box would clip it) into a root of its
 * own; `invoice-request.css` hides everything else while the class is on
 * `<html>`. The copy, the class and the page rule leave with the print dialog.
 */
export function printInvoiceRequest() {
  const sheet = document.querySelector(".ir-detail-dialog .ir-sheet");
  if (!sheet) return;
  const root = document.documentElement;
  const page = document.createElement("style");
  page.textContent = PAGE_RULE;
  const copy = document.createElement("div");
  copy.className = ROOT_CLASS;
  copy.appendChild(sheet.cloneNode(true));
  document.head.appendChild(page);
  document.body.appendChild(copy);
  root.classList.add(PRINTING_CLASS);
  const done = () => {
    root.classList.remove(PRINTING_CLASS);
    page.remove();
    copy.remove();
    window.removeEventListener("afterprint", done);
  };
  window.addEventListener("afterprint", done);
  window.print();
}
