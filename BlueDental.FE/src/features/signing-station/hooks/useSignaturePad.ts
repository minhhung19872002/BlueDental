import { useCallback, useEffect, useRef, useState, type PointerEvent } from "react";

/** A little thicker than a ballpoint so it reads on the printed sheet. */
const LINE_WIDTH = 2.5;

/**
 * A finger-or-stylus pad on a <canvas>. The bitmap follows the element's CSS
 * size times the screen density so the stroke stays sharp on a Retina iPad;
 * resizing clears it, as the drawing would be stretched otherwise.
 */
export function useSignaturePad() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const [isEmpty, setIsEmpty] = useState(true);

  const context = useCallback(() => canvasRef.current?.getContext("2d") ?? null, []);

  const fit = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    const { width, height } = canvas.getBoundingClientRect();
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(ratio, ratio);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = LINE_WIDTH;
    // The ink is the canvas's CSS `color` (a --bd-* token), not a hex here.
    ctx.strokeStyle = getComputedStyle(canvas).color;
    setIsEmpty(true);
  }, []);

  useEffect(() => {
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [fit]);

  const pointOf = (event: PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const onPointerDown = useCallback(
    (event: PointerEvent<HTMLCanvasElement>) => {
      const ctx = context();
      if (!ctx) return;
      event.currentTarget.setPointerCapture(event.pointerId);
      drawing.current = true;
      const { x, y } = pointOf(event);
      ctx.beginPath();
      ctx.moveTo(x, y);
      // A tap leaves a dot, as a pen would.
      ctx.lineTo(x + 0.1, y + 0.1);
      ctx.stroke();
      setIsEmpty(false);
    },
    [context],
  );

  const onPointerMove = useCallback(
    (event: PointerEvent<HTMLCanvasElement>) => {
      const ctx = context();
      if (!drawing.current || !ctx) return;
      const { x, y } = pointOf(event);
      ctx.lineTo(x, y);
      ctx.stroke();
    },
    [context],
  );

  const onPointerUp = useCallback(() => {
    drawing.current = false;
  }, []);

  const clear = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = context();
    if (!canvas || !ctx) return;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
    setIsEmpty(true);
  }, [context]);

  /** The drawing as `data:image/png;base64,…`, transparent where untouched. */
  const toDataUrl = useCallback(() => canvasRef.current?.toDataURL("image/png") ?? null, []);

  return {
    canvasRef,
    isEmpty,
    clear,
    toDataUrl,
    handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp },
  };
}
