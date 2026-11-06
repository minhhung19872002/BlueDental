import { useCallback, useState } from "react";

/**
 * The "Chọn" mode of Kho lưu trữ: which items are ticked, keyed by the
 * caller, holding the item so the bar can act on it after it scrolls away.
 */
export function useSharedSelection<T>() {
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<ReadonlyMap<string, T>>(() => new Map());

  const toggle = useCallback((key: string, item: T) => {
    setSelected((current) => {
      const next = new Map(current);
      if (next.has(key)) next.delete(key);
      else next.set(key, item);
      return next;
    });
  }, []);

  const clear = useCallback(() => setSelected(new Map()), []);

  const setMode = useCallback((on: boolean) => {
    setSelecting(on);
    setSelected(new Map());
  }, []);

  return { selecting, setMode, selected, toggle, clear };
}
