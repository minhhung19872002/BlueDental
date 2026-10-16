import { useEffect, useRef } from "react";
import type { SketchPad } from "./useSketchCanvas";

/**
 * The pad's keys: Ctrl+Z / Ctrl+Y (and Ctrl+Shift+Z) step through the
 * versions, Delete removes what is selected, Esc lets go of it.
 *
 * Listened for in the capture phase, ahead of the dialog: Esc would otherwise
 * close the whole dialog when all it meant was "deselect". While words are
 * being typed every key belongs to them.
 */
export function useSketchShortcuts(pad: SketchPad) {
  const current = useRef(pad);
  current.current = pad;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target;
      if (target instanceof HTMLTextAreaElement || target instanceof HTMLInputElement) return;
      if (target instanceof HTMLElement && target.isContentEditable) return;
      const now = current.current;
      const key = event.key.toLowerCase();

      if (event.ctrlKey || event.metaKey) {
        if (key === "z" && !event.shiftKey) now.undo();
        else if (key === "y" || (key === "z" && event.shiftKey)) now.redo();
        else return;
      } else if ((key === "delete" || key === "backspace") && now.selected) {
        now.deleteSelected();
      } else if (key === "escape" && now.selected) {
        now.deselect();
        event.stopPropagation();
      } else {
        return;
      }
      event.preventDefault();
    };

    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);
}
