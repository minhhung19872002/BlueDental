const PRINTING_CLASS = "pq-printing";

/**
 * Print only the open preview's sheet: `quote.css` hides everything else on
 * the page while the class is on `<body>`, and the class leaves with the
 * browser's print dialog.
 */
export function printQuoteSheet() {
  document.body.classList.add(PRINTING_CLASS);
  const done = () => {
    document.body.classList.remove(PRINTING_CLASS);
    window.removeEventListener("afterprint", done);
  };
  window.addEventListener("afterprint", done);
  window.print();
}
