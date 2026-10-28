import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import {
  DEFAULT_MINUTES,
  STEP_MINUTES,
  firstFreeRange,
  fitsIn,
  windowAt,
  type SessionTrack,
} from "../utils/followUpSlots";
import { spanLength } from "../utils/trackScale";
import type { MinuteSpan } from "../types/reception";

/**
 * What a press on the bar takes hold of: empty bar starts a new range, the
 * middle of the picked range moves it, either edge stretches that end.
 */
export type TrackGrip = "create" | "move" | "start" | "end";

/** Under the pointer before a press: a grip, or "blocked" over a booked visit or out of hours. */
export type TrackHover = TrackGrip | "blocked";

interface Drag {
  grip: TrackGrip;
  /** The range as it was when pressed (for "create", the first quarter hour). */
  origin: MinuteSpan;
  /** The open stretch the press landed in; the range stays inside it. */
  stretch: MinuteSpan;
  /** "move": how far into the range the press landed, in minutes. */
  offset: number;
  moved: boolean;
}

/** An edge is this many pixels either side of it. */
const EDGE_PX = 6;

const ARROW_STEP: Record<string, number> = { ArrowLeft: -STEP_MINUTES, ArrowRight: STEP_MINUTES };

const snap = (m: number) => Math.round(m / STEP_MINUTES) * STEP_MINUTES;
const clamp = (m: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, m));

/** The minute under the pointer — past the bar's ends too, so a drag can pull the view along. */
function minuteAt(e: PointerEvent<HTMLElement>, view: MinuteSpan, span: MinuteSpan): number {
  const rect = e.currentTarget.getBoundingClientRect();
  return clamp(view.start + ((e.clientX - rect.left) / rect.width) * spanLength(view), span.start, span.end);
}

function gripAt(e: PointerEvent<HTMLElement>, view: MinuteSpan, selected: MinuteSpan | undefined): TrackGrip {
  if (!selected) return "create";
  const rect = e.currentTarget.getBoundingClientRect();
  const xOf = (m: number) => rect.left + ((m - view.start) / spanLength(view)) * rect.width;
  const [x0, x1] = [xOf(selected.start), xOf(selected.end)];
  // Too narrow for two edges and a middle: it can only be moved.
  if (x1 - x0 >= 3 * EDGE_PX) {
    if (Math.abs(e.clientX - x0) <= EDGE_PX) return "start";
    if (Math.abs(e.clientX - x1) <= EDGE_PX) return "end";
  }
  return e.clientX > x0 && e.clientX < x1 ? "move" : "create";
}

/** Where the drag has taken the range, kept inside its free stretch — never over a booked visit. */
function dragged(d: Drag, m: number, free: MinuteSpan[]): MinuteSpan {
  const { origin, stretch } = d;
  if (d.grip === "start") return { start: clamp(snap(m), stretch.start, origin.end - STEP_MINUTES), end: origin.end };
  if (d.grip === "end") return { start: origin.start, end: clamp(snap(m), origin.start + STEP_MINUTES, stretch.end) };
  if (d.grip === "move") {
    const length = spanLength(origin);
    const moved = { start: snap(m - d.offset), end: snap(m - d.offset) + length };
    // Into another free stretch when it fits there whole; else against the edge of its own.
    if (fitsIn(free, moved)) return moved;
    const start = clamp(moved.start, stretch.start, stretch.end - length);
    return { start, end: start + length };
  }
  const point = clamp(snap(m), stretch.start, stretch.end);
  return point > origin.start ? { start: origin.start, end: point } : { start: point, end: origin.end };
}

/**
 * Picking a range on one session's bar with the pointer or the keyboard.
 * Enter / Space takes the first free half hour; ← / → move the range a
 * quarter hour, with Shift they move its end.
 */
export function useTrackDrag(
  track: SessionTrack | null,
  view: MinuteSpan | undefined,
  selected: MinuteSpan | undefined,
  onRange: (range: MinuteSpan) => void,
) {
  const drag = useRef<Drag | null>(null);
  const [hover, setHover] = useState<TrackHover>("create");
  const [held, setHeld] = useState<TrackGrip | null>(null);

  const handlePointerDown = (e: PointerEvent<HTMLElement>) => {
    if (!track || !view || e.button !== 0) return;
    const grip = gripAt(e, view, selected);
    const m = minuteAt(e, view, track.span);
    if (grip === "create") {
      const anchor = Math.min(Math.floor(m / STEP_MINUTES) * STEP_MINUTES, track.span.end - STEP_MINUTES);
      // On a booked visit (or out of hours) a press picks nothing.
      const stretch = windowAt(track.free, anchor);
      if (!stretch || stretch.end - anchor < STEP_MINUTES) return;
      const origin = { start: anchor, end: anchor + STEP_MINUTES };
      drag.current = { grip, origin, stretch, offset: 0, moved: false };
      onRange(origin);
    } else if (selected) {
      const stretch = windowAt(track.free, selected.start);
      if (!stretch) return;
      drag.current = { grip, origin: selected, stretch, offset: m - selected.start, moved: false };
    }
    e.currentTarget.setPointerCapture(e.pointerId);
    setHeld(grip);
  };

  const handlePointerMove = (e: PointerEvent<HTMLElement>) => {
    const d = drag.current;
    if (!track || !view) return;
    if (!d) {
      const grip = gripAt(e, view, selected);
      const quarter = Math.floor(minuteAt(e, view, track.span) / STEP_MINUTES) * STEP_MINUTES;
      setHover(grip === "create" && !windowAt(track.free, quarter) ? "blocked" : grip);
      return;
    }
    const range = dragged(d, minuteAt(e, view, track.span), track.free);
    if (range.start !== d.origin.start || range.end !== d.origin.end) d.moved = true;
    onRange(range);
  };

  const handlePointerUp = () => {
    const d = drag.current;
    drag.current = null;
    setHeld(null);
    if (d?.grip === "create" && !d.moved) {
      onRange({ start: d.origin.start, end: Math.min(d.origin.start + DEFAULT_MINUTES, d.stretch.end) });
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (!track) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      const range = firstFreeRange(track.free);
      if (range) onRange(range);
      return;
    }
    const by = ARROW_STEP[e.key];
    if (!by || !selected) return;
    e.preventDefault();
    onRange(e.shiftKey ? { ...selected, end: selected.end + by } : { start: selected.start + by, end: selected.end + by });
  };

  return {
    /** What the pointer holds, or would take hold of — for the cursor. */
    grip: held ?? hover,
    held: held !== null,
    handlers: {
      onPointerDown: handlePointerDown,
      onPointerMove: handlePointerMove,
      onPointerUp: handlePointerUp,
      onPointerCancel: handlePointerUp,
    },
    handleKeyDown,
  };
}
