import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { moveItem, replaceItem, startItem, textItem, type Item, type Point, type Scene, type SketchSettings } from "./sketch";
import { itemAt, touches } from "./sketchHit";
import { boundsOf, hasInk, paintItem, paintScene, paintSelection } from "./sketchPaint";
import { readItems, withItems } from "./sketchPng";

/** Words being typed: where, what so far, and the item they replace when it is an edit. */
export interface TextDraft {
  at: Point;
  text: string;
  editingId?: string;
}

/** What the pointer is doing between press and release; `inked` counts the samples already on the ink layer. */
type Gesture =
  | { kind: "draw"; item: Item; inked: number }
  | { kind: "erase"; removed: Set<string> }
  | { kind: "move"; id: string; from: Point; dx: number; dy: number };

interface History {
  versions: Scene[];
  at: number;
}

const BLANK: History = { versions: [{ items: [], backdrop: false }], at: 0 };

/**
 * A canvas the browser may show without waiting for the next composited frame
 * — the last frame of lag between the hand and the ink. Safe only on a canvas
 * that is added to and never cleared mid-stroke: one cleared and redrawn is
 * shown half-redrawn, which is how an earlier try made the pen tip twitch.
 */
const LOW_LATENCY: CanvasRenderingContext2DSettings = { desynchronized: true };

/**
 * The drawing pad: its canvases, what each tool does with the pointer, and the
 * versions undo steps through.
 *
 * Three layers. The *page* shows the drawing. The *ink* layer takes a pen or
 * highlighter stroke as it is drawn, one new stretch at a time and never
 * redrawn, so it can be shown at once. The *overlay* on top takes the pointer
 * and shows the rest — a shape being dragged out, the selection frame, the
 * eraser's ring. Nothing goes through React while the pointer is down, and a
 * finished stroke lands on the page in the event that ends it.
 */
export function useSketchCanvas(
  settings: SketchSettings,
  source: string,
  adopt: (patch: Partial<SketchSettings>) => void,
) {
  const [page, setPage] = useState<HTMLCanvasElement | null>(null);
  const [overlay, setOverlay] = useState<HTMLCanvasElement | null>(null);
  const [ink, setInk] = useState<HTMLCanvasElement | null>(null);
  const pageCtx = useMemo(() => page?.getContext("2d") ?? null, [page]);
  const inkCtx = useMemo(() => ink?.getContext("2d", LOW_LATENCY) ?? null, [ink]);
  const overlayCtx = useMemo(() => overlay?.getContext("2d") ?? null, [overlay]);

  const [history, setHistory] = useState<History>(BLANK);
  const scene = history.versions[history.at];
  const [backdrop, setBackdrop] = useState<HTMLImageElement | null>(null);
  const [loading, setLoading] = useState(Boolean(source));
  const [loadFailed, setLoadFailed] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [typing, setTyping] = useState<TextDraft | null>(null);

  // Read inside pointer handlers, which must not re-bind on every change.
  const live = useRef({ settings, scene, selectedId });
  live.current = { settings, scene, selectedId };
  const gesture = useRef<Gesture | null>(null);
  const box = useRef<DOMRect | null>(null);
  const ringAt = useRef<Point | null>(null);

  const commit = useCallback((next: Scene) => {
    setHistory((current) => ({ versions: [...current.versions.slice(0, current.at + 1), next], at: current.at + 1 }));
  }, []);

  // A saved drawing opens as its items when it carries them, else as a picture to draw over.
  useEffect(() => {
    if (!source) return;
    let open = true;
    const fail = () => {
      if (!open) return;
      setLoadFailed(true);
      setLoading(false);
    };
    readItems(source)
      .then((items) => {
        if (!open) return;
        if (items) {
          setHistory({ versions: [{ items, backdrop: false }], at: 0 });
          setLoading(false);
          return;
        }
        const picture = new Image();
        picture.onload = () => {
          if (!open) return;
          setBackdrop(picture);
          setHistory({ versions: [{ items: [], backdrop: true }], at: 0 });
          setLoading(false);
        };
        picture.onerror = fail;
        picture.src = source;
      })
      .catch(fail);
    return () => {
      open = false;
    };
  }, [source]);

  const editingId = typing?.editingId;

  const paintPage = useCallback(
    (shown: Scene) => {
      if (pageCtx) paintScene(pageCtx, backdrop, shown, editingId);
    },
    [pageCtx, backdrop, editingId],
  );

  const paintOverlay = useCallback(() => {
    if (!overlayCtx) return;
    overlayCtx.clearRect(0, 0, overlayCtx.canvas.width, overlayCtx.canvas.height);
    const now = gesture.current;
    // Strokes are on the ink layer; only a shape is dragged out here.
    if (now?.kind === "draw" && now.item.kind === "shape") paintItem(overlayCtx, now.item);

    const { scene: shown, selectedId: picked, settings: set } = live.current;
    const item = picked ? shown.items.find((entry) => entry.id === picked) : undefined;
    if (item && item.id !== editingId) {
      const moved = now?.kind === "move" ? moveItem(item, now.dx, now.dy) : item;
      paintSelection(overlayCtx, boundsOf(moved));
    }

    const ring = ringAt.current;
    if (ring && set.tool === "eraser") {
      overlayCtx.beginPath();
      overlayCtx.arc(ring.x, ring.y, set.sizes.eraser / 2, 0, Math.PI * 2);
      overlayCtx.lineWidth = 2;
      overlayCtx.strokeStyle = "rgba(15, 23, 42, .55)";
      overlayCtx.stroke();
    }
  }, [overlayCtx, editingId]);

  // Before the browser paints, so a finished edit is never a frame missing.
  useLayoutEffect(() => {
    paintPage(scene);
    paintOverlay();
  }, [scene, selectedId, paintPage, paintOverlay]);

  const pointOf = useCallback(
    (event: { clientX: number; clientY: number }): Point => {
      const rect = box.current;
      if (!overlay || !rect || rect.width === 0) return { x: 0, y: 0 };
      return {
        x: ((event.clientX - rect.left) * overlay.width) / rect.width,
        y: ((event.clientY - rect.top) * overlay.height) / rect.height,
      };
    },
    [overlay],
  );

  const startEditing = useCallback(
    (item: Item) => {
      if (item.kind !== "text") return;
      setSelectedId(null);
      adopt({ color: item.color, text: item.style });
      setTyping({ at: item.at, text: item.text, editingId: item.id });
    },
    [adopt],
  );

  const commitText = useCallback(() => {
    if (!typing) return;
    setTyping(null);
    const { scene: current, settings: set } = live.current;
    const words = typing.text.replace(/\s+$/, "");
    const editing = typing.editingId;

    if (!words.trim()) {
      if (editing) commit({ ...current, items: current.items.filter((item) => item.id !== editing) });
      return;
    }
    const item = textItem(set, words, typing.at, editing);
    commit({ ...current, items: editing ? replaceItem(current.items, item) : [...current.items, item] });
  }, [typing, commit]);

  const cancelText = useCallback(() => setTyping(null), []);
  const setTypingText = useCallback(
    (text: string) => setTyping((draft) => (draft ? { ...draft, text } : draft)),
    [],
  );

  // Leaving a tool finishes what it was doing. Keyed on the tool alone:
  // committing whenever the words changed would end the typing.
  const finishTool = useRef(commitText);
  finishTool.current = commitText;
  useEffect(() => {
    if (settings.tool !== "text") finishTool.current();
    if (settings.tool !== "select") setSelectedId(null);
  }, [settings.tool]);

  const eraseAt = useCallback(
    (points: Point[], removed: Set<string>) => {
      const { scene: current, settings: set } = live.current;
      let changed = false;
      for (const item of current.items) {
        if (removed.has(item.id)) continue;
        if (points.some((point) => touches(item, point, set.sizes.eraser / 2))) {
          removed.add(item.id);
          changed = true;
        }
      }
      if (changed) paintPage({ ...current, items: current.items.filter((item) => !removed.has(item.id)) });
    },
    [paintPage],
  );

  /**
   * Lays the samples of the stroke not yet on the ink layer, joined on from the
   * last one that is. A highlighter is laid solid and the whole layer shown
   * see-through, so where its pieces meet does not darken.
   */
  const layInk = useCallback(() => {
    const now = gesture.current;
    if (!inkCtx || now?.kind !== "draw" || now.item.kind !== "stroke") return;
    const { points, color, size, tool } = now.item;

    if (now.inked === 0 && ink) ink.dataset.highlighter = tool === "highlighter" ? "true" : "";
    inkCtx.lineCap = "round";
    inkCtx.lineJoin = "round";
    inkCtx.lineWidth = size;
    inkCtx.strokeStyle = color;
    inkCtx.fillStyle = color;

    if (now.inked === 0) {
      inkCtx.beginPath();
      inkCtx.arc(points[0].x, points[0].y, size / 2, 0, Math.PI * 2);
      inkCtx.fill();
      now.inked = 1;
    }
    if (points.length <= now.inked) return;

    inkCtx.beginPath();
    const from = points[now.inked - 1];
    inkCtx.moveTo(from.x, from.y);
    for (const point of points.slice(now.inked)) inkCtx.lineTo(point.x, point.y);
    inkCtx.stroke();
    now.inked = points.length;
  }, [inkCtx, ink]);

  const handlePointerDown = useCallback(
    (event: PointerEvent<HTMLCanvasElement>) => {
      if (loading || (event.pointerType === "mouse" && event.button !== 0)) return;
      box.current = event.currentTarget.getBoundingClientRect();
      const at = pointOf(event);
      const { scene: current, settings: set } = live.current;

      if (set.tool === "text") {
        // Kept from becoming a mousedown, which would take the focus from the box.
        event.preventDefault();
        if (typing) {
          commitText();
          return;
        }
        const hit = itemAt(current.items.filter((item) => item.kind === "text"), at);
        if (hit) startEditing(hit);
        else setTyping({ at, text: "" });
        return;
      }

      event.currentTarget.setPointerCapture(event.pointerId);
      if (set.tool === "select") {
        const hit = itemAt(current.items, at);
        setSelectedId(hit?.id ?? null);
        live.current.selectedId = hit?.id ?? null;
        gesture.current = hit ? { kind: "move", id: hit.id, from: at, dx: 0, dy: 0 } : null;
      } else if (set.tool === "eraser") {
        const removed = new Set<string>();
        gesture.current = { kind: "erase", removed };
        eraseAt([at], removed);
      } else {
        const item = startItem(set, at);
        gesture.current = item ? { kind: "draw", item, inked: 0 } : null;
        layInk();
      }
      ringAt.current = at;
      paintOverlay();
    },
    [loading, pointOf, typing, commitText, startEditing, eraseAt, paintOverlay, layInk],
  );

  const handlePointerMove = useCallback(
    (event: PointerEvent<HTMLCanvasElement>) => {
      const now = gesture.current;
      const canvas = event.currentTarget;
      if (!now) {
        box.current = canvas.getBoundingClientRect();
        const at = pointOf(event);
        ringAt.current = at;
        const { scene: current, settings: set } = live.current;
        if (set.tool === "select") canvas.dataset.hover = itemAt(current.items, at) ? "item" : "";
        if (set.tool === "eraser") paintOverlay();
        return;
      }

      // Every sample since the last event, not only the last — a fast stroke
      // would otherwise come out in straight pieces.
      const native = event.nativeEvent;
      const samples = native.getCoalescedEvents?.() ?? [];
      const points = (samples.length ? samples : [native]).map(pointOf);
      const at = points[points.length - 1];
      ringAt.current = at;

      if (now.kind === "draw") {
        if (now.item.kind === "stroke") {
          now.item.points.push(...points);
          layInk();
          return;
        }
        if (now.item.kind === "shape") now.item.to = at;
      } else if (now.kind === "erase") {
        eraseAt(points, now.removed);
      } else {
        now.dx = at.x - now.from.x;
        now.dy = at.y - now.from.y;
        const { scene: current } = live.current;
        const item = current.items.find((entry) => entry.id === now.id);
        if (item) paintPage({ ...current, items: replaceItem(current.items, moveItem(item, now.dx, now.dy)) });
      }
      paintOverlay();
    },
    [pointOf, eraseAt, paintPage, paintOverlay, layInk],
  );

  const handlePointerUp = useCallback(() => {
    const now = gesture.current;
    gesture.current = null;
    const { scene: current } = live.current;

    if (now?.kind === "draw") {
      // On the page now — not after React has rendered — and off the ink layer.
      if (pageCtx) paintItem(pageCtx, now.item);
      inkCtx?.clearRect(0, 0, inkCtx.canvas.width, inkCtx.canvas.height);
      if (ink) ink.dataset.highlighter = "";
      commit({ ...current, items: [...current.items, now.item] });
    } else if (now?.kind === "erase" && now.removed.size > 0) {
      commit({ ...current, items: current.items.filter((item) => !now.removed.has(item.id)) });
    } else if (now?.kind === "move" && Math.hypot(now.dx, now.dy) > 1) {
      const item = current.items.find((entry) => entry.id === now.id);
      if (item) commit({ ...current, items: replaceItem(current.items, moveItem(item, now.dx, now.dy)) });
    }
    paintOverlay();
  }, [pageCtx, inkCtx, ink, commit, paintOverlay]);

  const handlePointerLeave = useCallback(() => {
    if (gesture.current) return;
    ringAt.current = null;
    paintOverlay();
  }, [paintOverlay]);

  /** A double click on words, with the select tool, opens them for typing again. */
  const handleDoubleClick = useCallback(
    (event: { clientX: number; clientY: number }) => {
      if (live.current.settings.tool !== "select") return;
      const hit = itemAt(live.current.scene.items.filter((item) => item.kind === "text"), pointOf(event));
      if (hit) startEditing(hit);
    },
    [pointOf, startEditing],
  );

  const updateSelected = useCallback(
    (patch: { color?: string; size?: number }) => {
      const { scene: current, selectedId: picked } = live.current;
      const item = current.items.find((entry) => entry.id === picked);
      if (!item) return;
      let next: Item = item;
      if (patch.color) next = { ...next, color: patch.color };
      if (patch.size !== undefined && next.kind !== "text") next = { ...next, size: patch.size };
      if (next !== item) commit({ ...current, items: replaceItem(current.items, next) });
    },
    [commit],
  );

  const deleteSelected = useCallback(() => {
    const { scene: current, selectedId: picked } = live.current;
    if (!picked) return;
    setSelectedId(null);
    commit({ ...current, items: current.items.filter((item) => item.id !== picked) });
  }, [commit]);

  const step = useCallback((by: number) => {
    setSelectedId(null);
    setHistory((current) => ({ ...current, at: Math.max(0, Math.min(current.versions.length - 1, current.at + by)) }));
  }, []);
  const undo = useCallback(() => step(-1), [step]);
  const redo = useCallback(() => step(1), [step]);
  const deselect = useCallback(() => setSelectedId(null), []);

  const clear = useCallback(() => {
    setSelectedId(null);
    commit({ items: [], backdrop: false });
  }, [commit]);

  /** The finished drawing, its items written inside it; "" when the page is bare. */
  const toPng = useCallback((): string => {
    if (!page || !pageCtx || !hasInk(pageCtx)) return "";
    const png = page.toDataURL("image/png");
    // A picture still showing under the items cannot be split back out of them.
    return scene.backdrop ? png : withItems(png, scene.items);
  }, [page, pageCtx, scene]);

  return {
    pageRef: setPage,
    overlayRef: setOverlay,
    inkRef: setInk,
    loading,
    loadFailed,
    typing,
    setTypingText,
    commitText,
    cancelText,
    selected: scene.items.find((item) => item.id === selectedId) ?? null,
    updateSelected,
    deleteSelected,
    startEditing,
    deselect,
    changed: history.at > 0,
    canUndo: history.at > 0,
    canRedo: history.at < history.versions.length - 1,
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
      onDoubleClick: handleDoubleClick,
    },
  };
}

export type SketchPad = ReturnType<typeof useSketchCanvas>;
