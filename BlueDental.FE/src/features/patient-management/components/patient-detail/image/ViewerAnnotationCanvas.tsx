import { useCallback, useEffect, useRef, type PointerEvent } from "react";
import type { AnnotationPoint, AnnotationStroke, ViewerAnnotation } from "../../../hooks/useViewerAnnotation";

interface Props {
  /** The pen is out: the canvas takes the pointer. */
  active: boolean;
  annotation: ViewerAnnotation;
}

function paint(canvas: HTMLCanvasElement, strokes: AnnotationStroke[]) {
  const context = canvas.getContext("2d");
  if (!context) return;
  const ratio = window.devicePixelRatio || 1;
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.lineCap = "round";
  context.lineJoin = "round";
  for (const stroke of strokes) {
    if (stroke.points.length === 0) continue;
    context.strokeStyle = stroke.color;
    context.lineWidth = stroke.size;
    context.beginPath();
    stroke.points.forEach((point, index) =>
      index === 0 ? context.moveTo(point.x, point.y) : context.lineTo(point.x, point.y),
    );
    context.stroke();
  }
}

/**
 * Where a pointer lands on the picture itself, whatever zoom, rotation, flip
 * or pan the frame carries: the frame transforms about its centre, so the
 * centre of the on-screen box is the layout centre, and the inverse of the
 * frame's matrix takes the offset from there back into layout pixels.
 */
function pointOf(canvas: HTMLCanvasElement, event: PointerEvent<HTMLCanvasElement>): AnnotationPoint {
  const frame = canvas.parentElement;
  const box = canvas.getBoundingClientRect();
  const matrix = frame ? new DOMMatrix(getComputedStyle(frame).transform) : new DOMMatrix();
  const offset = new DOMPoint(event.clientX - (box.left + box.width / 2), event.clientY - (box.top + box.height / 2));
  const local = matrix.inverse().transformPoint(offset);
  return { x: local.x + canvas.clientWidth / 2, y: local.y + canvas.clientHeight / 2 };
}

/**
 * The drawing surface of "Vẽ chú thích", laid over the picture inside its
 * frame so the strokes zoom, turn, flip and pan with it. One stroke per
 * pointer gesture; it is handed to the annotation state when the pointer lifts.
 */
export function ViewerAnnotationCanvas({ active, annotation }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const current = useRef<AnnotationStroke | null>(null);
  const { strokes, color, size, commit } = annotation;

  const fit = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.round(canvas.clientWidth * ratio);
    canvas.height = Math.round(canvas.clientHeight * ratio);
    paint(canvas, current.current ? [...strokes, current.current] : strokes);
  }, [strokes]);

  useEffect(() => {
    fit();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const observer = new ResizeObserver(fit);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [fit]);

  const handleDown = (event: PointerEvent<HTMLCanvasElement>) => {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    current.current = { color, size, points: [pointOf(event.currentTarget, event)] };
  };
  const handleMove = (event: PointerEvent<HTMLCanvasElement>) => {
    const stroke = current.current;
    if (!stroke) return;
    stroke.points.push(pointOf(event.currentTarget, event));
    paint(event.currentTarget, [...strokes, stroke]);
  };
  const handleUp = () => {
    const stroke = current.current;
    current.current = null;
    if (stroke) commit(stroke);
  };

  return (
    <canvas
      ref={canvasRef}
      className={["pi-annotation", active && "pi-annotation--active"].filter(Boolean).join(" ")}
      aria-hidden="true"
      onPointerDown={active ? handleDown : undefined}
      onPointerMove={active ? handleMove : undefined}
      onPointerUp={active ? handleUp : undefined}
      onPointerCancel={active ? handleUp : undefined}
    />
  );
}
