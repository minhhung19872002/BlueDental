import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { clampView, panView, revealRange, spanLength, zoomView } from "../utils/trackScale";
import type { MinuteSpan } from "../types/reception";

/** Wheel pixels → zoom: a usual notch (100px) comes about 15% closer. */
const WHEEL_ZOOM = 0.0015;
/** Firefox reports wheel turns in lines. */
const LINE_PX = 16;
/** + / − on the focused bar. */
const KEY_ZOOM = 1.5;

/**
 * The stretch of a session's shift the bar shows. The whole shift at first;
 * the wheel (or a pinch) zooms around the pointer, Shift+wheel or a sideways
 * wheel pans, and a range picked out of sight brings the view to it. A wheel
 * that changes nothing is left to scroll the page.
 */
export function useTrackView(span: MinuteSpan | undefined, selected: MinuteSpan | undefined) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const spanKey = span ? `${span.start}-${span.end}` : "";
  // Tied to the shift it zoomed: another day's different hours start whole again.
  const [zoom, setZoom] = useState<{ key: string; view: MinuteSpan } | null>(null);
  const view = span && zoom?.key === spanKey ? zoom.view : span;
  const zoomed = !!span && !!view && spanLength(view) < spanLength(span);

  const selectedKey = selected ? `${selected.start}-${selected.end}` : "";
  const [seenSelected, setSeenSelected] = useState(selectedKey);
  if (seenSelected !== selectedKey) {
    setSeenSelected(selectedKey);
    if (zoomed && span && view && selected) {
      const next = revealRange(view, span, selected);
      if (next !== view) setZoom({ key: spanKey, view: next });
    }
  }

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const [viewStart, viewEnd, spanStart, spanEnd] = [view?.start, view?.end, span?.start, span?.end];
  useEffect(() => {
    const el = ref.current;
    if (!el || viewStart === undefined || viewEnd === undefined || spanStart === undefined || spanEnd === undefined) return;
    const current = { start: viewStart, end: viewEnd };
    const whole = { start: spanStart, end: spanEnd };

    // React's own wheel listener is passive, so this one is added by hand.
    const handleWheel = (e: WheelEvent) => {
      const unit = e.deltaMode === 1 ? LINE_PX : 1;
      const rect = el.getBoundingClientRect();
      const sideways = e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY);
      const next = sideways
        ? panView(current, whole, (((e.shiftKey ? e.deltaY : e.deltaX) * unit) / rect.width) * spanLength(current))
        : zoomView(current, whole, (e.clientX - rect.left) / rect.width, Math.exp(e.deltaY * unit * WHEEL_ZOOM));
      if (next.start === current.start && next.end === current.end) return;
      e.preventDefault();
      setZoom({ key: `${whole.start}-${whole.end}`, view: next });
    };
    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [viewStart, viewEnd, spanStart, spanEnd]);

  const reset = () => setZoom(null);

  /** The overview strip: the view, same width, centred on `minute`. */
  const centerOn = (minute: number) => {
    if (!span || !view) return;
    const half = spanLength(view) / 2;
    setZoom({ key: spanKey, view: clampView({ start: minute - half, end: minute + half }, span) });
  };

  /** + / − zoom about the middle, 0 shows the whole shift. True when the key was taken. */
  const handleZoomKey = (e: KeyboardEvent<HTMLElement>): boolean => {
    if (!span || !view) return false;
    if (e.key === "0") reset();
    else if (e.key === "+" || e.key === "=") setZoom({ key: spanKey, view: zoomView(view, span, 0.5, 1 / KEY_ZOOM) });
    else if (e.key === "-") setZoom({ key: spanKey, view: zoomView(view, span, 0.5, KEY_ZOOM) });
    else return false;
    e.preventDefault();
    return true;
  };

  return { ref, view, width, zoomed, reset, centerOn, handleZoomKey };
}
