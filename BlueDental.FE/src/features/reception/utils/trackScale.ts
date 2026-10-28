import type { CSSProperties } from "react";
import type { MinuteSpan } from "../types/reception";

/** The closest the bar zooms: one hour across. */
export const MIN_VIEW_MINUTES = 60;

/**
 * Tick labels ("08:00" at 10px) stay at least this far apart — which keeps a
 * whole four-hour shift at the design's half hours, and gives quarter hours
 * only once zoomed in.
 */
const MIN_TICK_GAP_PX = 56;
const TICK_STEPS = [15, 30, 60, 120, 180, 240, 360];
/** Quarter-hour grid lines once a quarter hour is this wide. */
const QUARTER_LINE_PX = 60;

export const spanLength = (s: MinuteSpan) => s.end - s.start;

const round = (m: number) => Math.round(m * 100) / 100;

/** `view` kept inside `span` and no narrower than the closest zoom. */
export function clampView(view: MinuteSpan, span: MinuteSpan): MinuteSpan {
  const width = Math.min(spanLength(span), Math.max(MIN_VIEW_MINUTES, spanLength(view)));
  const start = round(Math.min(span.end - width, Math.max(span.start, view.start)));
  return { start, end: round(start + width) };
}

/** Zoomed by `factor` (below 1 comes closer), the minute at `ratio` of the bar staying put. */
export function zoomView(view: MinuteSpan, span: MinuteSpan, ratio: number, factor: number): MinuteSpan {
  const pivot = view.start + ratio * spanLength(view);
  const width = Math.min(spanLength(span), Math.max(MIN_VIEW_MINUTES, spanLength(view) * factor));
  const start = pivot - ratio * width;
  return clampView({ start, end: start + width }, span);
}

export function panView(view: MinuteSpan, span: MinuteSpan, minutes: number): MinuteSpan {
  return clampView({ start: view.start + minutes, end: view.end + minutes }, span);
}

/** The view moved just enough to show `range`; the same object when it already does. */
export function revealRange(view: MinuteSpan, span: MinuteSpan, range: MinuteSpan): MinuteSpan {
  if (range.start >= view.start && range.end <= view.end) return view;
  const width = Math.max(spanLength(view), spanLength(range) + 30);
  const start = range.start < view.start ? range.start - 15 : range.end + 15 - width;
  return clampView({ start, end: start + width }, span);
}

function multiples(view: MinuteSpan, step: number, withEdges: boolean): number[] {
  const list: number[] = [];
  for (let m = Math.ceil(view.start / step) * step; m <= view.end; m += step) {
    if (withEdges || (m > view.start && m < view.end)) list.push(m);
  }
  return list;
}

/** Labelled ticks and grid lines over the view, as dense as the bar's width allows. */
export function scaleMarks(view: MinuteSpan, widthPx: number): { ticks: number[]; lines: number[] } {
  const perMinute = widthPx / spanLength(view);
  const step = TICK_STEPS.find((s) => s * perMinute >= MIN_TICK_GAP_PX) ?? TICK_STEPS[TICK_STEPS.length - 1];
  const lineStep = 15 * perMinute >= QUARTER_LINE_PX ? 15 : Math.max(30, step / 2);
  return { ticks: multiples(view, step, true), lines: multiples(view, lineStep, false) };
}

/** Where a part sits along the bar, as the custom properties `.fu-at` reads. */
export function placed(view: MinuteSpan, part: MinuteSpan): CSSProperties {
  const total = spanLength(view);
  return {
    "--fu-left": `${((part.start - view.start) / total) * 100}%`,
    "--fu-width": `${(spanLength(part) / total) * 100}%`,
  } as CSSProperties;
}
