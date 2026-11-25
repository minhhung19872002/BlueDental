import { useCallback, useEffect, useLayoutEffect, useRef, type PointerEvent as ReactPointerEvent, type RefObject } from "react";

/** How far the mouse travels before a press on a picture counts as "bôi" rather than a click. */
const START_DISTANCE = 6;
/** Within this many pixels of the scroll box's top or bottom the box scrolls by itself. */
const EDGE = 40;
/** The fastest the box scrolls, in pixels per frame, with the mouse at (or past) its edge. */
const MAX_SPEED = 18;
/** Controls that keep their own meaning under a press; the picture itself is not one of them. */
const OWN_CONTROLS = "button:not(.pi-card-picture), input, label, a, [role='checkbox'], .ant-checkbox-wrapper";

interface Point {
  x: number;
  y: number;
}

interface Options {
  /** The scroll box the marquee is drawn in and measured against. */
  scrollRef: RefObject<HTMLElement | null>;
  /** The marquee box itself, a child of the scroll box; it is placed and shown here. */
  boxRef: RefObject<HTMLElement | null>;
  /** The tiles the marquee can catch; each carries its id in `data-image-id`. */
  itemSelector: string;
  enabled: boolean;
  /** A drag begins: the caller notes what was ticked before it. */
  onStart: () => void;
  /** The ids under the marquee now, in the order they are drawn; called only when they change. */
  onChange: (ids: string[]) => void;
}

/** A point in the scroll box's content, so it stays put on the pictures while the box scrolls. */
function contentPoint(box: HTMLElement, clientX: number, clientY: number): Point {
  const rect = box.getBoundingClientRect();
  return {
    x: clientX - rect.left - box.clientLeft + box.scrollLeft,
    y: clientY - rect.top - box.clientTop + box.scrollTop,
  };
}

/** How far to scroll this frame: towards whichever edge the mouse is near, faster the nearer. */
function edgeSpeed(box: HTMLElement, clientY: number): number {
  const rect = box.getBoundingClientRect();
  const fromTop = clientY - rect.top;
  const fromBottom = rect.bottom - clientY;
  if (fromTop < EDGE) return -Math.ceil(MAX_SPEED * Math.min(1, (EDGE - fromTop) / EDGE));
  if (fromBottom < EDGE) return Math.ceil(MAX_SPEED * Math.min(1, (EDGE - fromBottom) / EDGE));
  return 0;
}

/** The click that ends a drag begun on a picture would open the viewer: swallow that one. */
function swallowNextClick() {
  const stop = (event: MouseEvent) => {
    event.stopPropagation();
    event.preventDefault();
  };
  window.addEventListener("click", stop, { capture: true, once: true });
  window.setTimeout(() => window.removeEventListener("click", stop, { capture: true }), 0);
}

/**
 * "Bôi để chọn" (R-1322): press the mouse in a scroll box — on a picture or
 * between them — and drag a rectangle; every tile it touches is reported, live,
 * while the drag goes on. Near the box's top or bottom edge the box scrolls by
 * itself, so pictures out of view can be caught too.
 *
 * Mouse only: a finger on a touch screen scrolls, and has the long press. A
 * press that moves less than a few pixels stays a click.
 */
export function useMarqueeSelect({ scrollRef, boxRef, itemSelector, enabled, onStart, onChange }: Options) {
  const callbacks = useRef({ onStart, onChange });
  useLayoutEffect(() => {
    callbacks.current = { onStart, onChange };
  }, [onStart, onChange]);
  const stopGesture = useRef<(() => void) | null>(null);

  useEffect(() => () => stopGesture.current?.(), []);
  useEffect(() => {
    if (!enabled) stopGesture.current?.();
  }, [enabled]);

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      const scroller = scrollRef.current;
      const marquee = boxRef.current;
      if (!enabled || !scroller || !marquee) return;
      if (event.pointerType !== "mouse" || event.button !== 0) return;
      const target = event.target as Element;
      if (target.closest(OWN_CONTROLS)) return;

      const origin = contentPoint(scroller, event.clientX, event.clientY);
      const pointer = { x: event.clientX, y: event.clientY };
      let started = false;
      let frame = 0;
      let lastKey = "";

      const draw = () => {
        const now = contentPoint(scroller, pointer.x, pointer.y);
        const left = Math.min(origin.x, now.x);
        const top = Math.min(origin.y, now.y);
        const right = Math.max(origin.x, now.x);
        const bottom = Math.max(origin.y, now.y);
        marquee.style.setProperty("--pi-marquee-x", `${left}px`);
        marquee.style.setProperty("--pi-marquee-y", `${top}px`);
        marquee.style.setProperty("--pi-marquee-w", `${right - left}px`);
        marquee.style.setProperty("--pi-marquee-h", `${bottom - top}px`);

        const ids: string[] = [];
        for (const item of scroller.querySelectorAll<HTMLElement>(itemSelector)) {
          const rect = item.getBoundingClientRect();
          const corner = contentPoint(scroller, rect.left, rect.top);
          const hit =
            corner.x < right && corner.x + rect.width > left && corner.y < bottom && corner.y + rect.height > top;
          const id = item.dataset.imageId;
          if (hit && id) ids.push(id);
        }
        const key = ids.join(",");
        if (key !== lastKey) {
          lastKey = key;
          callbacks.current.onChange(ids);
        }
      };

      const tick = () => {
        const speed = edgeSpeed(scroller, pointer.y);
        if (speed !== 0) scroller.scrollTop += speed;
        draw();
        frame = window.requestAnimationFrame(tick);
      };

      const begin = () => {
        started = true;
        window.getSelection()?.removeAllRanges();
        scroller.dataset.marquee = "on";
        callbacks.current.onStart();
        frame = window.requestAnimationFrame(tick);
      };

      const handleMove = (move: PointerEvent) => {
        pointer.x = move.clientX;
        pointer.y = move.clientY;
        if (started) return;
        const travelled = Math.hypot(move.clientX - event.clientX, move.clientY - event.clientY);
        if (travelled >= START_DISTANCE) begin();
      };

      const stop = () => {
        window.removeEventListener("pointermove", handleMove);
        window.removeEventListener("pointerup", handleUp);
        window.removeEventListener("pointercancel", stop);
        window.removeEventListener("selectstart", preventSelect);
        window.cancelAnimationFrame(frame);
        delete scroller.dataset.marquee;
        stopGesture.current = null;
      };

      const handleUp = () => {
        if (started) {
          draw();
          swallowNextClick();
        }
        stop();
      };

      const preventSelect = (select: Event) => {
        if (started) select.preventDefault();
      };

      stopGesture.current?.();
      stopGesture.current = stop;
      window.addEventListener("pointermove", handleMove);
      window.addEventListener("pointerup", handleUp);
      window.addEventListener("pointercancel", stop);
      window.addEventListener("selectstart", preventSelect);
    },
    [enabled, scrollRef, boxRef, itemSelector],
  );

  return { onPointerDown };
}
