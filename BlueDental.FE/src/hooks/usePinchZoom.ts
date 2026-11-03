import { useEffect, useLayoutEffect, useRef, type RefObject } from "react";

export interface PinchHandlers {
  /** Two fingers are down: the gesture measures from what is shown now. */
  onPinchStart?: () => void;
  /** The fingers' spread over their spread at the start: 2 is twice as far apart. */
  onPinch: (scale: number) => void;
  /** Fewer than two fingers are left. */
  onPinchEnd?: () => void;
}

function spread(touches: TouchList): number {
  const [a, b] = [touches[0], touches[1]];
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
}

/**
 * Two-finger zoom on a touch screen for a view that keeps its own zoom.
 * Only a two-finger gesture is taken (and kept from the browser, so the page
 * itself does not zoom); one finger still scrolls or drags as before. The
 * listeners are attached by hand because React's touch listeners are passive.
 * `enabled` also re-attaches them to an element that has just been mounted.
 */
export function usePinchZoom(
  targetRef: RefObject<HTMLElement | null>,
  enabled: boolean,
  handlers: PinchHandlers,
): void {
  const latest = useRef(handlers);
  useLayoutEffect(() => {
    latest.current = handlers;
  });

  useEffect(() => {
    const el = targetRef.current;
    if (!el || !enabled) return;
    let start = 0;

    const handleStart = (event: TouchEvent) => {
      if (event.touches.length !== 2) return;
      event.preventDefault();
      start = spread(event.touches) || 1;
      latest.current.onPinchStart?.();
    };
    const handleMove = (event: TouchEvent) => {
      if (!start || event.touches.length < 2) return;
      event.preventDefault();
      latest.current.onPinch(spread(event.touches) / start);
    };
    const handleEnd = (event: TouchEvent) => {
      if (!start || event.touches.length >= 2) return;
      start = 0;
      latest.current.onPinchEnd?.();
    };

    el.addEventListener("touchstart", handleStart, { passive: false });
    el.addEventListener("touchmove", handleMove, { passive: false });
    el.addEventListener("touchend", handleEnd);
    el.addEventListener("touchcancel", handleEnd);
    return () => {
      el.removeEventListener("touchstart", handleStart);
      el.removeEventListener("touchmove", handleMove);
      el.removeEventListener("touchend", handleEnd);
      el.removeEventListener("touchcancel", handleEnd);
    };
  }, [targetRef, enabled]);
}
