import { useCallback, useEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";

interface ActiveOptionConfig<T> {
  items: T[];
  open: boolean;
  onPick: (item: T) => void;
}

/**
 * The row the keyboard is on in an open list: ↑ / ↓ move it (wrapping at the
 * ends), Enter picks it. The mouse moves the same row, so there is only ever
 * one highlight. The row is kept in view as it moves.
 */
export function useActiveOption<T>({ items, open, onPick }: ActiveOptionConfig<T>) {
  const [activeIndex, setActiveIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  // The list narrows under the index as the keyword changes.
  const safeIndex = items.length ? Math.min(Math.max(activeIndex, 0), items.length - 1) : -1;

  useEffect(() => {
    const list = listRef.current;
    if (!open || !list || safeIndex < 0) return;
    const row = list.querySelector<HTMLElement>(`[data-index="${safeIndex}"]`);
    if (!row) return;
    if (row.offsetTop < list.scrollTop) {
      list.scrollTop = row.offsetTop;
    } else if (row.offsetTop + row.offsetHeight > list.scrollTop + list.clientHeight) {
      list.scrollTop = row.offsetTop + row.offsetHeight - list.clientHeight;
    }
  }, [open, safeIndex]);

  const handleListKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.nativeEvent.isComposing || !items.length) return;
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const step = e.key === "ArrowDown" ? 1 : -1;
        setActiveIndex((safeIndex + step + items.length) % items.length);
      } else if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        onPick(items[safeIndex]);
      }
    },
    [items, safeIndex, onPick]
  );

  return { activeIndex: safeIndex, setActiveIndex, listRef, handleListKeyDown };
}
