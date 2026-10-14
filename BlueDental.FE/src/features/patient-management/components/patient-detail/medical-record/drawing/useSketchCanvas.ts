import { useCallback, useEffect, useRef, useState, type PointerEvent } from "react";
import { hasInk, paintAll, paintMark, startMark, type Mark, type Point, type SketchSettings } from "./sketch";

interface History {
  marks: Mark[];
  undone: Mark[];
}

const EMPTY_HISTORY: History = { marks: [], undone: [] };

/**
 * The drawing pad's two canvases and what the pointer does on them.
 *
 * The *page* holds the drawing; the *overlay* above it shows the mark being
 * made — a stroke or shape is only painted onto the page once the pointer
 * lifts, so a shape can be dragged out and a highlighter laid down as one
 * even wash. The eraser is the exception: it works straight on the page,
 * which is the only place it has anything to take away.
 */
export function useSketchCanvas(settings: SketchSettings, backdropSource: string) {
  const [page, setPage] = useState<HTMLCanvasElement | null>(null);
  const [overlay, setOverlay] = useState<HTMLCanvasElement | null>(null);

  /** The marks on the page, oldest first; undone ones wait in `undone` for a redo. */
  const [{ marks, undone }, setHistory] = useState<History>(EMPTY_HISTORY);

  const [backdrop, setBackdrop] = useState<HTMLImageElement | null>(null);
  const [loading, setLoading] = useState(Boolean(backdropSource));
  const [loadFailed, setLoadFailed] = useState(false);

  // Read on every pointer move; a ref, so changing a colour never re-binds them.
  const current = useRef(settings);
  current.current = settings;
  const making = useRef<Mark | null>(null);

  useEffect(() => {
    if (!backdropSource) return;
    let live = true;
    const picture = new Image();
    picture.onload = () => {
      if (!live) return;
      setBackdrop(picture);
      setLoading(false);
    };
    picture.onerror = () => {
      if (!live) return;
      setLoadFailed(true);
      setLoading(false);
    };
    picture.src = backdropSource;
    return () => {
      live = false;
    };
  }, [backdropSource]);

  // Undo, redo and a fresh backdrop all redraw the page from its marks.
  useEffect(() => {
    const ctx = page?.getContext("2d");
    if (ctx) paintAll(ctx, backdrop, marks);
  }, [page, backdrop, marks]);

  const pointOf = useCallback(
    (event: { clientX: number; clientY: number }): Point => {
      if (!overlay) return { x: 0, y: 0 };
      const box = overlay.getBoundingClientRect();
      return {
        x: ((event.clientX - box.left) * overlay.width) / box.width,
        y: ((event.clientY - box.top) * overlay.height) / box.height,
      };
    },
    [overlay],
  );

  /** The eraser's reach, drawn as a ring where the pointer is. */
  const showEraserAt = useCallback(
    (at: Point | null) => {
      const ctx = overlay?.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      if (!at || current.current.tool !== "eraser") return;
      ctx.save();
      ctx.beginPath();
      ctx.arc(at.x, at.y, current.current.eraser.size / 2, 0, Math.PI * 2);
      ctx.lineWidth = 2;
      ctx.strokeStyle = "rgba(15, 23, 42, .55)";
      ctx.stroke();
      ctx.restore();
    },
    [overlay],
  );

  const preview = useCallback(
    (mark: Mark, at: Point) => {
      if (mark.kind === "stroke" && mark.tool === "eraser") {
        const ctx = page?.getContext("2d");
        // Only the newest stretch: what came before is already erased.
        if (ctx) paintMark(ctx, { ...mark, points: mark.points.slice(-2) });
        showEraserAt(at);
        return;
      }
      const ctx = overlay?.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      paintMark(ctx, mark);
    },
    [page, overlay, showEraserAt],
  );

  const handlePointerDown = useCallback(
    (event: PointerEvent<HTMLCanvasElement>) => {
      if (loading || (event.pointerType === "mouse" && event.button !== 0)) return;
      event.currentTarget.setPointerCapture(event.pointerId);
      const at = pointOf(event);
      making.current = startMark(current.current, at);
      preview(making.current, at);
    },
    [loading, pointOf, preview],
  );

  const handlePointerMove = useCallback(
    (event: PointerEvent<HTMLCanvasElement>) => {
      const mark = making.current;
      if (!mark) {
        showEraserAt(pointOf(event));
        return;
      }

      // Every sample the device took since the last frame, not just the last
      // one — a fast stroke would otherwise come out as straight segments.
      const samples = event.nativeEvent.getCoalescedEvents?.() ?? [];
      const points = (samples.length ? samples : [event]).map(pointOf);
      const at = points[points.length - 1];

      if (mark.kind === "shape") mark.to = at;
      else if (mark.kind === "stroke") mark.points.push(...points);
      preview(mark, at);
    },
    [pointOf, preview, showEraserAt],
  );

  const handlePointerUp = useCallback(
    (event: PointerEvent<HTMLCanvasElement>) => {
      const mark = making.current;
      making.current = null;
      showEraserAt(event.type === "pointerup" ? pointOf(event) : null);
      if (!mark) return;
      setHistory((history) => ({ marks: [...history.marks, mark], undone: [] }));
    },
    [pointOf, showEraserAt],
  );

  const handlePointerLeave = useCallback(() => {
    if (!making.current) showEraserAt(null);
  }, [showEraserAt]);

  const undo = useCallback(() => {
    setHistory((history) => {
      const last = history.marks.at(-1);
      if (!last) return history;
      return { marks: history.marks.slice(0, -1), undone: [...history.undone, last] };
    });
  }, []);

  const redo = useCallback(() => {
    setHistory((history) => {
      const next = history.undone.at(-1);
      if (!next) return history;
      return { marks: [...history.marks, next], undone: history.undone.slice(0, -1) };
    });
  }, []);

  const clear = useCallback(() => {
    setHistory((history) => ({ marks: [...history.marks, { kind: "clear" }], undone: [] }));
  }, []);

  /** The finished drawing as a PNG, or "" when the page has been left bare. */
  const toPng = useCallback((): string => {
    const ctx = page?.getContext("2d");
    if (!page || !ctx || !hasInk(ctx)) return "";
    return page.toDataURL("image/png");
  }, [page]);

  return {
    pageRef: setPage,
    overlayRef: setOverlay,
    loading,
    loadFailed,
    changed: marks.length > 0,
    canUndo: marks.length > 0,
    canRedo: undone.length > 0,
    undo,
    redo,
    clear,
    toPng,
    handlers: {
      onPointerDown: handlePointerDown,
      onPointerMove: handlePointerMove,
      onPointerUp: handlePointerUp,
      onPointerCancel: handlePointerUp,
      onPointerLeave: handlePointerLeave,
    },
  };
}
