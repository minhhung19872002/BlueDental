/**
 * True once a scrolled list is within `threshold` px of its last row — the
 * moment a paged dropdown should ask for the next page.
 */
export function isNearScrollEnd(element: HTMLElement, threshold = 48): boolean {
  return element.scrollTop + element.clientHeight >= element.scrollHeight - threshold;
}
