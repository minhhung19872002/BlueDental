import { flowParts } from "./flowLines";

/**
 * The caret as a place in a blank's whole value (flowedText): a blank whose
 * text flowed over several lines is still one value, with one character —
 * a space or a line break — between each of its lines.
 */

/** How many characters of `owner`'s value come before the point `node`/`offset`, or null when it is not in the blank. */
export function offsetInFlowed(owner: Element, node: Node, offset: number): number | null {
  let before = 0;
  for (const part of flowParts(owner)) {
    if (part === node || part.contains(node)) {
      const range = owner.ownerDocument.createRange();
      range.setStart(part, 0);
      range.setEnd(node, offset);
      return before + range.toString().length;
    }
    before += (part.textContent?.length ?? 0) + 1;
  }
  return null;
}

/** Puts the caret `offset` characters into the blank's value, on whichever of its lines that falls. */
export function placeCaretAt(field: Element, offset: number) {
  const doc = field.ownerDocument;
  let left = offset;
  const parts = flowParts(field);
  const at = parts.find((part, index) => {
    const length = part.textContent?.length ?? 0;
    if (left <= length || index === parts.length - 1) return true;
    left -= length + 1;
    return false;
  });
  const host = at ?? field;
  const text = host.firstChild;
  const selection = doc.getSelection();
  host.closest<HTMLElement>("[contenteditable]")?.focus({ preventScroll: true });
  if (text && text.nodeType === Node.TEXT_NODE) {
    selection?.collapse(text, Math.min(Math.max(left, 0), text.textContent?.length ?? 0));
  } else {
    selection?.collapse(host, 0);
  }
}
