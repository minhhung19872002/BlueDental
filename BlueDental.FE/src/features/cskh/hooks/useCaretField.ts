import { useLayoutEffect, useRef } from "react";

type TextField = HTMLTextAreaElement | HTMLInputElement;

/** Where the caret goes once the value written by an insert is on screen. */
interface PendingCaret {
  value: string;
  at: number;
}

/**
 * A controlled text box that can take text at its caret — a variable from the
 * library, a chip or the `{` suggestions. The box keeps its selection while
 * blurred, so a click elsewhere still inserts where the user left off.
 */
export function useCaretField(value: string, onChange: (next: string) => void) {
  const element = useRef<TextField | null>(null);
  const pendingCaret = useRef<PendingCaret | null>(null);

  // React leaves the caret at the end when it writes a new value; put it back
  // in the same commit, as StageNoteInput does (R-983).
  useLayoutEffect(() => {
    const pending = pendingCaret.current;
    const field = element.current;
    if (!pending || pending.value !== value || !field) return;
    pendingCaret.current = null;
    field.focus();
    field.setSelectionRange(pending.at, pending.at);
  }, [value]);

  const replace = (from: number, to: number, text: string) => {
    const next = value.slice(0, from) + text + value.slice(to);
    pendingCaret.current = { value: next, at: from + text.length };
    onChange(next);
  };

  const insertAtCaret = (text: string) => {
    const field = element.current;
    const start = field?.selectionStart ?? value.length;
    const end = field?.selectionEnd ?? start;
    replace(start, end, text);
  };

  return { element, replace, insertAtCaret };
}

export type CaretField = ReturnType<typeof useCaretField>;
