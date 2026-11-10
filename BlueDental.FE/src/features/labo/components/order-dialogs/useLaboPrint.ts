import { useEffect } from "react";

/** The browser's file name for the printed sheet, as the reference names it. */
const sheetTitle = (orderCode: string) => `phieu-labo-${orderCode}`;

/**
 * The sheet is laid out for A4. Without a size of its own the page takes the
 * printer's default paper — a PDF printer's can be far narrower — and the sheet
 * then reflows: oversized type, the letterhead's columns run into each other,
 * three sheets for one (owner, 2026-11-10). Like printInvoiceRequest's A5 rule,
 * it is only on the page while this sheet prints.
 */
const PAGE_RULE_ID = "pd-labo-page-rule";
const PAGE_RULE = "@page { size: A4; margin: 0; }";

/**
 * "In Phiếu Labo": prints the LaboPrintSheet mounted beside the dialog. The
 * print class, page rule and title are dropped when the browser is finished
 * (see TreatmentHistoryPrintDialog): window.print() does not reliably block
 * until the preview closes.
 */
export function useLaboPrint(orderCode: string | undefined): () => void {
  useEffect(() => {
    const title = document.title;
    const done = () => {
      document.body.classList.remove("pd-printing");
      document.getElementById(PAGE_RULE_ID)?.remove();
      document.title = title;
    };
    window.addEventListener("afterprint", done);
    return () => {
      window.removeEventListener("afterprint", done);
      done();
    };
  }, []);

  return () => {
    if (!orderCode) return;
    if (!document.getElementById(PAGE_RULE_ID)) {
      const rule = document.createElement("style");
      rule.id = PAGE_RULE_ID;
      rule.textContent = PAGE_RULE;
      document.head.appendChild(rule);
    }
    document.title = sheetTitle(orderCode);
    document.body.classList.add("pd-printing");
    window.print();
  };
}
