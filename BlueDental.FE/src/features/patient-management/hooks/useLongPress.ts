import { useCallback, useEffect, useRef, type MouseEvent, type PointerEvent } from "react";

/** How long a finger rests on a picture before it counts as a long press. */
const HOLD_MS = 500;

/**
 * A long press with a finger — the touch screen's way into a selection, where
 * there is no hover to show the tick. A mouse never triggers it, and a finger
 * that starts scrolling cancels it (the browser cancels the pointer).
 *
 * The press ends in a click, which `consumeClick` swallows once so the same
 * touch does not also open the picture.
 */
export function useLongPress(onLongPress: () => void) {
  const timer = useRef<number | null>(null);
  const fired = useRef(false);

  const cancel = useCallback(() => {
    if (timer.current === null) return;
    window.clearTimeout(timer.current);
    timer.current = null;
  }, []);

  useEffect(() => cancel, [cancel]);

  const onPointerDown = useCallback(
    (event: PointerEvent) => {
      fired.current = false;
      if (event.pointerType !== "touch") return;
      cancel();
      timer.current = window.setTimeout(() => {
        timer.current = null;
        fired.current = true;
        onLongPress();
      }, HOLD_MS);
    },
    [cancel, onLongPress],
  );

  /** The phone's own long-press menu would cover the tick that just appeared. */
  const onContextMenu = useCallback((event: MouseEvent) => {
    if (fired.current || timer.current !== null) event.preventDefault();
  }, []);

  const consumeClick = useCallback(() => {
    const was = fired.current;
    fired.current = false;
    return was;
  }, []);

  return {
    handlers: { onPointerDown, onPointerUp: cancel, onPointerLeave: cancel, onPointerCancel: cancel, onContextMenu },
    consumeClick,
  };
}
