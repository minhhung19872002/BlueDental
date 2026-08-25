import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import { moveItem } from "@/utils/array";

interface Options<T> {
  items: T[];
  getKey: (item: T) => string;
  /** False while a filter is on: reordering a partial list would move the wrong rows. */
  enabled: boolean;
  /**
   * Persists the move. The list keeps showing the dragged order until this
   * settles, so a successful save never flashes the old order and a failed one
   * snaps back to what the server actually holds.
   */
  onCommit: (from: number, to: number) => void | Promise<void>;
}

export interface DragReorder<T> {
  /** The order to render — the dragged order while a drag is in flight. */
  items: T[];
  /** Key of the row being dragged, for styling it as lifted. */
  draggingKey: string | null;
  /** Ref callback each row must register with, so a drag can hit-test it. */
  registerRow: (key: string) => (element: HTMLElement | null) => void;
  /** Spread onto the row's grip. */
  handleProps: (key: string) => {
    onPointerDown: (event: ReactPointerEvent) => void;
    style: CSSProperties;
  };
}

/**
 * Drag-to-reorder where the row follows the pointer — in both directions — and
 * the rest of the list moves out of its way as it passes, the way the reference
 * application behaves.
 *
 * Built on pointer events rather than the HTML5 drag-and-drop API: HTML5 drag
 * needs `draggable` set before the gesture starts, fires no event until the
 * browser decides a drag began, and paints its own ghost image — which is what
 * made the previous version feel late and jumpy.
 *
 * The lifted row is moved by writing `transform` straight onto its element, so
 * following the pointer costs no React render; a render happens only when rows
 * actually change places.
 *
 * A drag is a pointer gesture, so it is unavailable to keyboard users; screens
 * using this must keep offering an explicit "move up / move down" command.
 */
export function useDragReorder<T>({ items, getKey, enabled, onCommit }: Options<T>): DragReorder<T> {
  /** Non-null only while dragging or while the move is being saved. */
  const [live, setLive] = useState<T[] | null>(null);
  const [draggingKey, setDraggingKey] = useState<string | null>(null);

  const rows = useRef(new Map<string, HTMLElement>());
  // The pointer handlers live on `window` for the length of one gesture, so
  // they read the current order through refs rather than a stale closure.
  const liveRef = useRef<T[]>(items);
  const itemsRef = useRef<T[]>(items);
  const getKeyRef = useRef(getKey);
  const commitRef = useRef(onCommit);
  const enabledRef = useRef(enabled);

  itemsRef.current = items;
  getKeyRef.current = getKey;
  commitRef.current = onCommit;
  enabledRef.current = enabled;

  // Both of these are handed to memoised rows, so the same key has to give back
  // the same function every render — a fresh closure would re-render every row.
  const rowRefs = useRef(new Map<string, (element: HTMLElement | null) => void>());
  const handles = useRef(new Map<string, ReturnType<DragReorder<T>["handleProps"]>>());

  const registerRow = useCallback((key: string) => {
    const cached = rowRefs.current.get(key);
    if (cached) return cached;

    const setRef = (element: HTMLElement | null) => {
      if (element) rows.current.set(key, element);
      else rows.current.delete(key);
    };

    rowRefs.current.set(key, setRef);
    return setRef;
  }, []);

  const startDrag = useCallback((key: string, pointerX: number, pointerY: number) => {
    const element = rows.current.get(key);
    const from = itemsRef.current.findIndex((item) => getKeyRef.current(item) === key);
    if (!element || from < 0) return;

    liveRef.current = itemsRef.current;
    setLive(itemsRef.current);
    setDraggingKey(key);

    const startRect = element.getBoundingClientRect();
    /** Where inside the row the pointer took hold, so it stays under that point. */
    const grabX = pointerX - startRect.left;
    const grabY = pointerY - startRect.top;

    const translate = { x: 0, y: 0 };
    let lastX = pointerX;
    let lastY = pointerY;
    let frame = 0;

    // The grip is small and the pointer leaves it as soon as rows move, so the
    // grabbing cursor is held on the document for the length of the gesture.
    const previousCursor = document.body.style.cursor;
    document.body.style.cursor = "grabbing";

    element.style.zIndex = "20";
    element.style.position = "relative";
    // The lifted row must not sit between the pointer and the rows it passes.
    element.style.pointerEvents = "none";
    element.style.willChange = "transform";

    /** Puts the lifted row back under the pointer, wherever its slot now is. */
    const follow = () => {
      const rect = element.getBoundingClientRect();
      const slotLeft = rect.left - translate.x;
      const slotTop = rect.top - translate.y;

      translate.x = lastX - grabX - slotLeft;
      translate.y = lastY - grabY - slotTop;
      element.style.transform = `translate3d(${translate.x}px, ${translate.y}px, 0)`;
    };

    const indexOfDragged = () =>
      liveRef.current.findIndex((item) => getKeyRef.current(item) === key);

    const move = (event: PointerEvent) => {
      lastX = event.clientX;
      lastY = event.clientY;
      follow();

      const current = liveRef.current;
      const at = indexOfDragged();
      if (at < 0) return;

      for (let index = 0; index < current.length; index++) {
        if (index === at) continue;

        const other = rows.current.get(getKeyRef.current(current[index]));
        if (!other) continue;

        // Only the lifted row is transformed, so every other rect is where the
        // row actually sits.
        const rect = other.getBoundingClientRect();
        if (event.clientY < rect.top || event.clientY > rect.bottom) continue;

        const next = moveItem(current, at, index);
        liveRef.current = next;
        setLive(next);

        // React moves the row to its new slot on the next paint; re-follow then,
        // or it would sit one slot off for a frame.
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(follow);
        return;
      }
    };

    const stop = async (commit: boolean) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
      window.removeEventListener("keydown", onKeyDown);
      cancelAnimationFrame(frame);

      document.body.style.cursor = previousCursor;
      element.style.transform = "";
      element.style.zIndex = "";
      element.style.position = "";
      element.style.pointerEvents = "";
      element.style.willChange = "";
      setDraggingKey(null);

      const to = indexOfDragged();
      if (commit && to >= 0 && to !== from) {
        try {
          await commitRef.current(from, to);
        } finally {
          setLive(null);
        }
        return;
      }

      setLive(null);
    };

    const up = () => void stop(true);
    const cancel = () => void stop(false);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") void stop(false);
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
    window.addEventListener("keydown", onKeyDown);
  }, []);

  // A gesture in flight when the screen goes away would leave the document
  // stuck on the grabbing cursor.
  useEffect(
    () => () => {
      document.body.style.cursor = "";
    },
    [],
  );

  const handleProps = useCallback(
    (key: string) => {
      const cached = handles.current.get(key);
      if (cached) return cached;

      const props = {
        onPointerDown: (event: ReactPointerEvent) => {
          if (!enabledRef.current || event.button !== 0) return;
          // Without this the browser starts a text selection instead.
          event.preventDefault();
          startDrag(key, event.clientX, event.clientY);
        },
        // Keeps a touch drag from scrolling the panel at the same time.
        style: { touchAction: "none" } as CSSProperties,
      };

      handles.current.set(key, props);
      return props;
    },
    [startDrag],
  );

  return {
    items: live ?? items,
    draggingKey,
    registerRow,
    handleProps,
  };
}
