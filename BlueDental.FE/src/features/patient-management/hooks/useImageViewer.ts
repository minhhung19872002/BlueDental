import { useCallback, useEffect, useState } from "react";

export interface ViewerPan {
  x: number;
  y: number;
}

export interface ViewerTransform {
  zoom: number;
  /** Degrees, multiples of 90. */
  rotate: number;
  flipX: boolean;
  flipY: boolean;
  /** Screen-space offset of the picture while zoomed in; zero at zoom 1. */
  pan: ViewerPan;
}

const NO_PAN: ViewerPan = { x: 0, y: 0 };
const IDENTITY: ViewerTransform = { zoom: 1, rotate: 0, flipX: false, flipY: false, pan: NO_PAN };
export const ZOOM_MIN = 1;
export const ZOOM_MAX = 4;
/** The toolbar buttons step by half; the wheel and double-click use their own. */
const ZOOM_STEP = 0.5;
const WHEEL_STEP = 0.25;
const DOUBLE_CLICK_ZOOM = 2;

function clampZoom(value: number): number {
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(value * 100) / 100));
}

export interface ImageViewer {
  index: number;
  transform: ViewerTransform;
  drawing: boolean;
  canZoomOut: boolean;
  canZoomIn: boolean;
  zoomIn: () => void;
  zoomOut: () => void;
  /** Wheel: up zooms in, down zooms out, a quarter step at a time. */
  zoomByWheel: (deltaY: number) => void;
  /** Double-click: in to 2x from rest, back to rest from anywhere else. */
  toggleZoom: () => void;
  setPan: (pan: ViewerPan) => void;
  rotateLeft: () => void;
  rotateRight: () => void;
  flipHorizontal: () => void;
  flipVertical: () => void;
  toggleDrawing: () => void;
  prev: () => void;
  next: () => void;
  goTo: (index: number) => void;
}

/**
 * The state behind the full-screen viewer: which image is up, how it is
 * turned, and whether the annotation pen is out. Moving to another image
 * resets all of it, the way lightGallery does. Esc closes, ← → page; both
 * are ignored while the pen is out so a stray key does not lose a drawing.
 * Zooming back to rest drops the pan, so the picture is never left off-centre.
 */
export function useImageViewer(count: number, initialIndex: number, onClose: () => void): ImageViewer {
  const [index, setIndex] = useState(initialIndex);
  const [transform, setTransform] = useState(IDENTITY);
  const [drawing, setDrawing] = useState(false);

  const goTo = useCallback(
    (next: number) => {
      if (count === 0) return;
      setIndex(((next % count) + count) % count);
      setTransform(IDENTITY);
      setDrawing(false);
    },
    [count],
  );
  const prev = useCallback(() => goTo(index - 1), [goTo, index]);
  const next = useCallback(() => goTo(index + 1), [goTo, index]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (drawing) return;
      if (event.key === "ArrowLeft") prev();
      if (event.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, prev, next, drawing]);

  const patch = (change: (current: ViewerTransform) => Partial<ViewerTransform>) =>
    setTransform((current) => ({ ...current, ...change(current) }));
  const zoomTo = (target: (current: number) => number) =>
    patch((c) => {
      const zoom = clampZoom(target(c.zoom));
      return { zoom, pan: zoom === ZOOM_MIN ? NO_PAN : c.pan };
    });

  return {
    index,
    transform,
    drawing,
    canZoomOut: transform.zoom > ZOOM_MIN,
    canZoomIn: transform.zoom < ZOOM_MAX,
    zoomIn: () => zoomTo((zoom) => zoom + ZOOM_STEP),
    zoomOut: () => zoomTo((zoom) => zoom - ZOOM_STEP),
    zoomByWheel: (deltaY) => zoomTo((zoom) => zoom + (deltaY < 0 ? WHEEL_STEP : -WHEEL_STEP)),
    toggleZoom: () => zoomTo((zoom) => (zoom === ZOOM_MIN ? DOUBLE_CLICK_ZOOM : ZOOM_MIN)),
    setPan: (pan) => patch(() => ({ pan })),
    rotateLeft: () => patch((c) => ({ rotate: c.rotate - 90 })),
    rotateRight: () => patch((c) => ({ rotate: c.rotate + 90 })),
    flipHorizontal: () => patch((c) => ({ flipX: !c.flipX })),
    flipVertical: () => patch((c) => ({ flipY: !c.flipY })),
    toggleDrawing: () => setDrawing((on) => !on),
    prev,
    next,
    goTo,
  };
}
