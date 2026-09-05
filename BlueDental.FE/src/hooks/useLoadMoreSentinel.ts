import { useEffect, useRef } from "react";

/** The nearest ancestor that scrolls, so a list inside a panel is measured against the panel, not the window. */
function scrollParent(element: HTMLElement): Element | null {
  let node = element.parentElement;
  while (node) {
    const { overflowY } = getComputedStyle(node);
    if (overflowY === "auto" || overflowY === "scroll") return node;
    node = node.parentElement;
  }
  return null;
}

/**
 * Calls `onLoadMore` whenever the element the returned ref is on comes into
 * view, for lists that grow as they are read. Pass `active` false while a page
 * is loading or when there is nothing left, and the sentinel stays quiet.
 *
 * The observer is rebuilt each time `active` flips back on, so a page too
 * short to scroll keeps asking for the next one until the panel is full.
 */
export function useLoadMoreSentinel(active: boolean, onLoadMore: () => void, rootMargin = "200px") {
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!active || !sentinel) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) onLoadMore();
      },
      { root: scrollParent(sentinel), rootMargin, threshold: 0 },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [active, onLoadMore, rootMargin]);

  return sentinelRef;
}
