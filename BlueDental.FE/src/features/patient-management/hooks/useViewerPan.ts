import { useEffect, useRef, useState, type PointerEvent, type RefObject } from "react";
import type { ViewerPan } from "./useImageViewer";

interface Options {
  /** Only a picture larger than its stage can be dragged about. */
  enabled: boolean;
  frameRef: RefObject<HTMLElement | null>;
  pan: ViewerPan;
  onPan: (pan: ViewerPan) => void;
  /** Wheel over the stage: negative deltaY is "up", zoom in. */
  onWheel: (deltaY: number) => void;
}

export interface ViewerPanHandlers {
  panning: boolean;
  onPointerDown: (event: PointerEvent<HTMLElement>) => void;
  onPointerMove: (event: PointerEvent<HTMLElement>) => void;
  onPointerUp: (event: PointerEvent<HTMLElement>) => void;
}

/**
 * Keeps the picture inside its stage: the offset may go only as far as the
 * overflow on each side, so an edge never drifts past the middle of the view.
 */
function clampToStage(frame: HTMLElement, pan: ViewerPan): ViewerPan {
  const stage = frame.parentElement;
  if (!stage) return pan;
  const shown = frame.getBoundingClientRect();
  const room = stage.getBoundingClientRect();
  const boundX = Math.max(0, (shown.width - room.width) / 2);
  const boundY = Math.max(0, (shown.height - room.height) / 2);
  return {
    x: Math.min(boundX, Math.max(-boundX, pan.x)),
    y: Math.min(boundY, Math.max(-boundY, pan.y)),
  };
}

/**
 * Dragging a zoomed picture around, and zooming with the wheel: the two
 * gestures lightGallery's zoom plugin gives the reference. The wheel listener
 * is attached natively so the page under the viewer never scrolls.
 */
export function useViewerPan({ enabled, frameRef, pan, onPan, onWheel }: Options): ViewerPanHandlers {
  const [panning, setPanning] = useState(false);
  const grab = useRef<{ pointer: ViewerPan; pan: ViewerPan } | null>(null);

  useEffect(() => {
    const stage = frameRef.current?.parentElement;
    if (!stage) return;
    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      onWheel(event.deltaY);
    };
    stage.addEventListener("wheel", handleWheel, { passive: false });
    return () => stage.removeEventListener("wheel", handleWheel);
  }, [frameRef, onWheel]);

  const onPointerDown = (event: PointerEvent<HTMLElement>) => {
    if (!enabled || event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    grab.current = { pointer: { x: event.clientX, y: event.clientY }, pan };
    setPanning(true);
  };
  const onPointerMove = (event: PointerEvent<HTMLElement>) => {
    const start = grab.current;
    const frame = frameRef.current;
    if (!start || !frame) return;
    onPan(
      clampToStage(frame, {
        x: start.pan.x + event.clientX - start.pointer.x,
        y: start.pan.y + event.clientY - start.pointer.y,
      }),
    );
  };
  const onPointerUp = () => {
    grab.current = null;
    setPanning(false);
  };

  return { panning, onPointerDown, onPointerMove, onPointerUp };
}
