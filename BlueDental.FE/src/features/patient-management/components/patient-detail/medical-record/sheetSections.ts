/**
 * Parts of a form that show only when a box is ticked, and the numbers that
 * follow them (clinic, 2026-10-16, mẫu 5): "Chi tiết răng sứ" appears when
 * "Răng sứ" is ticked under Phương pháp điều trị, "Chi tiết Implant" when
 * "Implant" is, and the items under it number themselves 1, 2, 3 over the ones
 * shown.
 *
 * In the template: `data-show-when="<checkbox id>"` on every block of such a
 * part, and `data-item-number="<series>"` on the span that holds an item's
 * number.
 */

const SHOW_WHEN = "data-show-when";
const ITEM_NUMBER = "data-item-number";

function isTicked(root: ParentNode, id: string): boolean {
  // While the sheet is built the property follows the `checked` attribute;
  // on an open sheet it is what the user just did.
  const box = root.querySelector<HTMLInputElement>(`input[data-medical-record-field="${id}"]`);
  return Boolean(box?.checked);
}

/** Shows or hides the conditional parts and renumbers the items. */
export function applySections(root: ParentNode) {
  root.querySelectorAll<HTMLElement>(`[${SHOW_WHEN}]`).forEach((block) => {
    const shown = isTicked(root, block.getAttribute(SHOW_WHEN) ?? "");
    if (shown) block.removeAttribute("hidden");
    else block.setAttribute("hidden", "");
  });

  const counters = new Map<string, number>();
  root.querySelectorAll<HTMLElement>(`[${ITEM_NUMBER}]`).forEach((span) => {
    if (span.closest("[hidden]")) return;
    const series = span.getAttribute(ITEM_NUMBER) ?? "";
    const next = (counters.get(series) ?? 0) + 1;
    counters.set(series, next);
    span.textContent = String(next);
  });
}

/** Keeps an open sheet's parts in step with its boxes; returns the call that stops. */
export function attachSections(doc: Document): () => void {
  const onChange = (event: Event) => {
    const target = event.target as Element | null;
    if (target?.matches?.("input[data-medical-record-field]")) applySections(doc);
  };
  doc.addEventListener("change", onChange);
  return () => doc.removeEventListener("change", onChange);
}
