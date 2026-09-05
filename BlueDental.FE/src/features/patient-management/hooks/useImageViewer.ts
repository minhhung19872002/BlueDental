import { useCallback, useEffect, useState } from "react";

export interface ViewerTransform {
  zoom: number;
  /** Degrees, multiples of 90. */
  rotate: number;
  flipX: boolean;
  flipY: boolean;
}

const IDENTITY: ViewerTransform = { zoom: 1, rotate: 0, flipX: false, flipY: false };
export const ZOOM_MIN = 1;
export const ZOOM_MAX = 4;
const ZOOM_STEP = 0.5;

export interface ImageViewer {
  index: number;
  transform: ViewerTransform;
  drawing: boolean;
  canZoomOut: boolean;
  canZoomIn: boolean;
  zoomIn: () => void;
  zoomOut: () => void;
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

  return {
    index,
    transform,
    drawing,
    canZoomOut: transform.zoom > ZOOM_MIN,
    canZoomIn: transform.zoom < ZOOM_MAX,
    zoomIn: () => patch((c) => ({ zoom: Math.min(ZOOM_MAX, c.zoom + ZOOM_STEP) })),
    zoomOut: () => patch((c) => ({ zoom: Math.max(ZOOM_MIN, c.zoom - ZOOM_STEP) })),
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
