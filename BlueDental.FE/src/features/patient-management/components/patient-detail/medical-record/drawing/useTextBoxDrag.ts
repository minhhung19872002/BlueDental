import { useCallback, useRef, type PointerEvent, type RefObject } from "react";
import { SKETCH_HEIGHT, SKETCH_WIDTH, TEXT_BOX_MIN, type Point } from "./sketch";

/** A handle on the box's frame, or "move" for its dashed edge. */
export type BoxGrip = "move" | "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

export interface TextBoxFrame {
  at: Point;
  width: number;
  height: number;
}

const clamp = (value: number, low: number, high: number) => Math.min(Math.max(value, low), high);

/** The box after a grip was dragged by dx, dy page pixels; it stays on the page and never shrinks past the minimum. */
export function dragFrame(start: TextBoxFrame, grip: BoxGrip, dx: number, dy: number): TextBoxFrame {
  if (grip === "move") {
    return {
      ...start,
      at: {
        x: clamp(start.at.x + dx, 0, Math.max(0, SKETCH_WIDTH - start.width)),
        y: clamp(start.at.y + dy, 0, SKETCH_HEIGHT - TEXT_BOX_MIN),
      },
    };
  }
  let { x, y } = start.at;
  let right = x + start.width;
  let bottom = y + start.height;
  if (grip.includes("w")) x = clamp(x + dx, 0, right - TEXT_BOX_MIN);
  if (grip.includes("e")) right = clamp(right + dx, x + TEXT_BOX_MIN, SKETCH_WIDTH);
  if (grip.includes("n")) y = clamp(y + dy, 0, bottom - TEXT_BOX_MIN);
  if (grip.includes("s")) bottom = Math.max(bottom + dy, y + TEXT_BOX_MIN);
  return { at: { x, y }, width: right - x, height: bottom - y };
}

interface Drag {
  grip: BoxGrip;
  start: TextBoxFrame;
  x: number;
  y: number;
  /** CSS pixels per page pixel. */
  scale: number;
}

/**
 * Paint's handles on a text box: the eight squares size it, its dashed edge
 * moves it. Words rewrap as it is sized. The caret stays in the words.
 */
export function useTextBoxDrag(
  frameRef: RefObject<HTMLDivElement | null>,
  box: TextBoxFrame,
  onChange: (next: TextBoxFrame) => void,
) {
  const drag = useRef<Drag | null>(null);
  const live = useRef(box);
  live.current = box;

  return useCallback(
    (grip: BoxGrip) => ({
      onPointerDown: (event: PointerEvent<HTMLElement>) => {
        const frame = frameRef.current;
        if (!frame?.parentElement || event.button !== 0) return;
        // Not a mousedown: that would take the caret out of the words.
        event.preventDefault();
        event.stopPropagation();
        event.currentTarget.setPointerCapture(event.pointerId);
        const scale = frame.parentElement.clientWidth / SKETCH_WIDTH;
        // Sized from the height it shows, which the words may have stretched past the one set.
        const start = { ...live.current, height: Math.max(live.current.height, frame.offsetHeight / scale) };
        drag.current = { grip, start, x: event.clientX, y: event.clientY, scale };
      },
      onPointerMove: (event: PointerEvent<HTMLElement>) => {
        const now = drag.current;
        if (!now) return;
        onChange(dragFrame(now.start, now.grip, (event.clientX - now.x) / now.scale, (event.clientY - now.y) / now.scale));
      },
      onPointerUp: () => {
        drag.current = null;
      },
      onPointerCancel: () => {
        drag.current = null;
      },
    }),
    [frameRef, onChange],
  );
}
