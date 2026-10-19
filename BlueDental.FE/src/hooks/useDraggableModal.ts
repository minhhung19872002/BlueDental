import { useCallback, useRef, useState, type CSSProperties, type PointerEvent } from "react";

interface Offset {
  x: number;
  y: number;
}

interface DragStart {
  pointerX: number;
  pointerY: number;
  base: Offset;
  /** How far the box may still travel each way before it leaves the window. */
  bounds: { left: number; right: number; up: number; down: number };
}

/** Pixels of the title that must stay on screen, so the box can always be dragged back. */
const VISIBLE_TITLE = 48;

/** Presses that start on a control inside the handle belong to that control. */
const INTERACTIVE = "button, a, input, textarea, select, [role='button']";

const ORIGIN: Offset = { x: 0, y: 0 };

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export interface DraggableModal {
  /** Spread on the box's wrapper: the offset travels as two CSS custom properties. */
  dragStyle: CSSProperties;
  /** Spread on the handle — the dialog's title row. */
  handleProps: {
    onPointerDown: (event: PointerEvent<HTMLElement>) => void;
    onPointerMove: (event: PointerEvent<HTMLElement>) => void;
    onPointerUp: (event: PointerEvent<HTMLElement>) => void;
    onPointerCancel: (event: PointerEvent<HTMLElement>) => void;
  };
  /** Puts the box back where the dialog opens it. */
  reset: () => void;
}

/**
 * Lets a dialog be dragged by its title row and keeps it inside the window.
 *
 * The offset is kept in state and handed out as `--drag-x` / `--drag-y`, which
 * the wrapper's class turns into a `translate`, so nothing is positioned with
 * an inline style. The bounds are measured once, when the press starts, from
 * the `.ant-modal-container` the handle sits in — the part `modalRender` wraps.
 */
export function useDraggableModal(): DraggableModal {
  const [offset, setOffset] = useState<Offset>(ORIGIN);
  const drag = useRef<DragStart | null>(null);

  const onPointerDown = useCallback(
    (event: PointerEvent<HTMLElement>) => {
      if (event.button !== 0) return;
      if (event.target instanceof Element && event.target.closest(INTERACTIVE)) return;
      const box = event.currentTarget.closest(".ant-modal-container") ?? event.currentTarget;
      const rect = box.getBoundingClientRect();
      drag.current = {
        pointerX: event.clientX,
        pointerY: event.clientY,
        base: offset,
        bounds: {
          left: -(rect.left + rect.width - VISIBLE_TITLE),
          right: window.innerWidth - rect.left - VISIBLE_TITLE,
          up: -rect.top,
          down: window.innerHeight - rect.top - VISIBLE_TITLE,
        },
      };
      event.currentTarget.setPointerCapture(event.pointerId);
      event.preventDefault();
    },
    [offset],
  );

  const onPointerMove = useCallback((event: PointerEvent<HTMLElement>) => {
    const start = drag.current;
    if (!start) return;
    const { bounds } = start;
    setOffset({
      x: start.base.x + clamp(event.clientX - start.pointerX, bounds.left, bounds.right),
      y: start.base.y + clamp(event.clientY - start.pointerY, bounds.up, bounds.down),
    });
  }, []);

  const endDrag = useCallback((event: PointerEvent<HTMLElement>) => {
    if (!drag.current) return;
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }, []);

  const reset = useCallback(() => setOffset(ORIGIN), []);

  return {
    dragStyle: { "--drag-x": `${offset.x}px`, "--drag-y": `${offset.y}px` } as CSSProperties,
    handleProps: { onPointerDown, onPointerMove, onPointerUp: endDrag, onPointerCancel: endDrag },
    reset,
  };
}
