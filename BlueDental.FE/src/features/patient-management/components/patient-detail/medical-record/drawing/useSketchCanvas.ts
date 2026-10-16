import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import {
  PAGE_PX_PER_POINT,
  SKETCH_LINE_HEIGHT,
  SKETCH_WIDTH,
  TEXT_BOX_MIN,
  TEXT_BOX_WIDTH,
  moveItem,
  newItemId,
  replaceItem,
  startItem,
  type Cut,
  type Item,
  type Point,
  type Scene,
  type SketchSettings,
  type TextAlign,
  type TextRun,
} from "./sketch";
import { finishRuns, textOf } from "./richText";
import { eraseScene } from "./sketchErase";
import { itemAt } from "./sketchHit";
import { boundsOf, hasInk, paintCut, paintItem, paintScene, paintSelection } from "./sketchPaint";
import { readItems, withItems } from "./sketchPng";
import type { RichTextHandle } from "./useRichText";

/** A text box open for typing: where it is, how big, and the words it opened with. */
export interface TextDraft {
  /** The item it becomes — a new one, or the one being typed over. */
  id: string;
  editing: boolean;
  at: Point;
  width: number;
  height: number;
  align: TextAlign;
  /** What is typed lives in the box itself until it is put down. */
  runs: TextRun[];
}

export type TextBoxPatch = Partial<Pick<TextDraft, "at" | "width" | "height" | "align">>;

/** A press with the text tool that moves further than this drags a box out; less opens one. */
const BOX_DRAG = 6;

/**
 * What the pointer is doing between press and release; `inked` counts the
 * samples already on the ink layer, `rubbed` those already rubbed off the page.
 */
type Gesture =
  | { kind: "draw"; item: Item; inked: number }
  | { kind: "erase"; cut: Cut; rubbed: number }
  | { kind: "move"; id: string; from: Point; dx: number; dy: number }
  | { kind: "box"; from: Point; to: Point };

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
  const textEditor = useRef<RichTextHandle | null>(null);

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

  const editingId = typing?.editing ? typing.id : undefined;

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
    if (now?.kind === "box" && Math.hypot(now.to.x - now.from.x, now.to.y - now.from.y) > BOX_DRAG) {
      overlayCtx.setLineDash([6, 4]);
      overlayCtx.lineWidth = 1.5;
      overlayCtx.strokeStyle = "rgba(15, 23, 42, .7)";
      overlayCtx.strokeRect(now.from.x, now.from.y, now.to.x - now.from.x, now.to.y - now.from.y);
      overlayCtx.setLineDash([]);
    }

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
      const [first] = item.runs;
      if (first) adopt({ color: first.color, text: { ...first.style, align: item.align } });
      const { id, at, width, height, align, runs } = item;
      setTyping({ id, editing: true, at, width, height, align, runs });
    },
    [adopt],
  );

  const commitText = useCallback(() => {
    if (!typing) return;
    setTyping(null);
    const { scene: current } = live.current;
    const runs = finishRuns(textEditor.current?.read() ?? typing.runs);
    const { id, editing, at, width, height, align } = typing;

    if (!textOf(runs).trim()) {
      if (editing) commit({ ...current, items: current.items.filter((item) => item.id !== id) });
      return;
    }
    const item: Item = { id, kind: "text", at, width, height, align, runs };
    // Untouched, it keeps what the eraser took; typed over, it comes back whole.
    const before = current.items.find((entry) => entry.id === id);
    if (before && JSON.stringify({ ...before, cuts: undefined }) === JSON.stringify(item)) return;
    commit({ ...current, items: editing ? replaceItem(current.items, item) : [...current.items, item] });
  }, [typing, commit]);

  const cancelText = useCallback(() => setTyping(null), []);
  const setTypingBox = useCallback(
    (patch: TextBoxPatch) => setTyping((draft) => (draft ? { ...draft, ...patch } : draft)),
    [],
  );

  /** As in Paint: a click opens a box one line tall, a drag opens it the size dragged. */
  const openBox = useCallback((from: Point, to: Point) => {
    const { text } = live.current.settings;
    const dragged = Math.hypot(to.x - from.x, to.y - from.y) > BOX_DRAG;
    const x = Math.min(dragged ? Math.min(from.x, to.x) : from.x, SKETCH_WIDTH - TEXT_BOX_MIN);
    const y = dragged ? Math.min(from.y, to.y) : from.y;
    const width = dragged ? Math.abs(to.x - from.x) : Math.min(TEXT_BOX_WIDTH, SKETCH_WIDTH - x);
    const height = dragged ? Math.abs(to.y - from.y) : text.points * PAGE_PX_PER_POINT * SKETCH_LINE_HEIGHT;
    setTyping({
      id: newItemId(),
      editing: false,
      at: { x, y },
      width: Math.max(TEXT_BOX_MIN, Math.min(width, SKETCH_WIDTH - x)),
      height: Math.max(TEXT_BOX_MIN, height),
      align: text.align,
      runs: [],
    });
  }, []);

  // Leaving a tool finishes what it was doing. Keyed on the tool alone:
  // committing whenever the words changed would end the typing.
  const finishTool = useRef(commitText);
  finishTool.current = commitText;
  useEffect(() => {
    if (settings.tool !== "text") finishTool.current();
    if (settings.tool !== "select") setSelectedId(null);
  }, [settings.tool]);

  /** Rubs what the eraser has gone over since last time straight off the page, as Paint does. */
  const rubOut = useCallback(() => {
    const now = gesture.current;
    if (!pageCtx || now?.kind !== "erase") return;
    paintCut(pageCtx, now.cut, now.rubbed);
    now.rubbed = now.cut.points.length;
  }, [pageCtx]);

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
        if (hit) {
          startEditing(hit);
          return;
        }
        event.currentTarget.setPointerCapture(event.pointerId);
        gesture.current = { kind: "box", from: at, to: at };
        return;
      }

      event.currentTarget.setPointerCapture(event.pointerId);
      if (set.tool === "select") {
        const hit = itemAt(current.items, at);
        setSelectedId(hit?.id ?? null);
        live.current.selectedId = hit?.id ?? null;
        gesture.current = hit ? { kind: "move", id: hit.id, from: at, dx: 0, dy: 0 } : null;
      } else if (set.tool === "eraser") {
        gesture.current = { kind: "erase", cut: { size: set.sizes.eraser, points: [at] }, rubbed: 0 };
        rubOut();
      } else {
        const item = startItem(set, at);
        gesture.current = item ? { kind: "draw", item, inked: 0 } : null;
        layInk();
      }
      ringAt.current = at;
      paintOverlay();
    },
    [loading, pointOf, typing, commitText, startEditing, rubOut, paintOverlay, layInk],
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
      } else if (now.kind === "box") {
        now.to = at;
      } else if (now.kind === "erase") {
        now.cut.points.push(...points);
        rubOut();
      } else {
        now.dx = at.x - now.from.x;
        now.dy = at.y - now.from.y;
        const { scene: current } = live.current;
        const item = current.items.find((entry) => entry.id === now.id);
        if (item) paintPage({ ...current, items: replaceItem(current.items, moveItem(item, now.dx, now.dy)) });
      }
      paintOverlay();
    },
    [pointOf, rubOut, paintPage, paintOverlay, layInk],
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
    } else if (now?.kind === "box") {
      openBox(now.from, now.to);
    } else if (now?.kind === "erase") {
      const erased = eraseScene(current, now.cut);
      if (erased) commit(erased);
      else paintPage(current);
    } else if (now?.kind === "move" && Math.hypot(now.dx, now.dy) > 1) {
      const item = current.items.find((entry) => entry.id === now.id);
      if (item) commit({ ...current, items: replaceItem(current.items, moveItem(item, now.dx, now.dy)) });
    }
    paintOverlay();
  }, [pageCtx, inkCtx, ink, commit, paintPage, paintOverlay, openBox]);

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
      const { color, size } = patch;
      let next: Item = item;
      if (next.kind === "text") {
        if (color) next = { ...next, runs: next.runs.map((run) => ({ ...run, color })) };
      } else {
        if (color) next = { ...next, color };
        if (size !== undefined) next = { ...next, size };
      }
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
    textEditor,
    setTypingBox,
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
