import { useEffect } from "react";

/** The browser's file name for the printed sheet, as the reference names it. */
const sheetTitle = (orderCode: string) => `phieu-labo-${orderCode}`;

/**
 * "In Phiếu Labo": prints the LaboPrintSheet mounted beside the dialog. The
 * print class and title are dropped when the browser is finished (see
 * TreatmentHistoryPrintDialog): window.print() does not reliably block until
 * the preview closes.
 */
export function useLaboPrint(orderCode: string | undefined): () => void {
  useEffect(() => {
    const title = document.title;
    const done = () => {
      document.body.classList.remove("pd-printing");
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
    document.title = sheetTitle(orderCode);
    document.body.classList.add("pd-printing");
    window.print();
  };
}
