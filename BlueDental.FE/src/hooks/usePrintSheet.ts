import { useCallback, useEffect } from "react";

const PRINTING_CLASS = "pd-printing";

/**
 * Prints the `.pd-print-sheet` portaled onto <body>: the shared print rule in
 * index.css hides the body's other children while the class is on it.
 *
 * The class leaves on `afterprint`, not on the next line — window.print() does
 * not reliably block until the preview closes, and dropping it early puts the
 * page back before anything is rendered. Unmounting clears it as well.
 */
export function usePrintSheet() {
  useEffect(() => {
    const done = () => document.body.classList.remove(PRINTING_CLASS);
    window.addEventListener("afterprint", done);
    return () => {
      window.removeEventListener("afterprint", done);
      done();
    };
  }, []);

  return useCallback(() => {
    document.body.classList.add(PRINTING_CLASS);
    window.print();
  }, []);
}
