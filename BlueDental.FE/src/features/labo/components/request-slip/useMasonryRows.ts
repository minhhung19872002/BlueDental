import { useLayoutEffect, useRef, type RefObject } from "react";

/** A block's width in grid columns, read from its `is-span-N` class and held to the grid's columns. */
function spanOf(block: HTMLElement, cols: number): number {
  const match = /\bis-span-(\d)\b/.exec(block.className);
  return Math.min(cols, Math.max(1, match ? Number(match[1]) : 1));
}

/**
 * Packs the blocks of a `.rs-masonry` grid without row gaps (R-1202). The grid
 * runs on thin rows (`grid-auto-rows`); the blocks are placed in the
 * template's order, left to right across the columns, each starting in the
 * next free column (a block too wide for what is left of the line starts a new
 * one) and sitting right under the lowest bottom of the columns it covers. So
 * a column fills up under a short block, and the default layout reads as the
 * fixed slip's three columns. Placed again whenever a block or the grid
 * resizes (a list loads, a picture lands, the window narrows).
 */
export function useMasonryRows<T extends HTMLElement>(): RefObject<T | null> {
  const ref = useRef<T>(null);

  useLayoutEffect(() => {
    const grid = ref.current;
    if (!grid) return;
    const blocks = Array.from(grid.children).filter((child): child is HTMLElement => child instanceof HTMLElement);
    const place = () => {
      const style = getComputedStyle(grid);
      const row = parseFloat(style.gridAutoRows) || 1;
      const gap = parseFloat(style.columnGap) || 0;
      const cols = Math.max(1, style.gridTemplateColumns.split(/\s+/).filter(Boolean).length);
      const bottoms = new Array<number>(cols).fill(0);
      let cursor = 0;
      for (const block of blocks) {
        const span = spanOf(block, cols);
        if (cursor + span > cols) cursor = 0;
        const covered = bottoms.slice(cursor, cursor + span);
        const top = Math.max(...covered);
        // offsetHeight ignores a drag's transform; the block keeps its own height (align-self: start).
        const rows = Math.max(1, Math.ceil((block.offsetHeight + gap) / row));
        block.style.setProperty("--rs-col", String(cursor + 1));
        block.style.setProperty("--rs-span", String(span));
        block.style.setProperty("--rs-row", String(top + 1));
        block.style.setProperty("--rs-rows", String(rows));
        bottoms.fill(top + rows, cursor, cursor + span);
        cursor = (cursor + span) % cols;
      }
    };
    place();
    // The grid matters for its width only (its columns); its height follows the placing itself.
    let width = grid.clientWidth;
    const observer = new ResizeObserver((entries) => {
      const gridOnly = entries.every((entry) => entry.target === grid);
      if (gridOnly && grid.clientWidth === width) return;
      width = grid.clientWidth;
      place();
    });
    observer.observe(grid);
    blocks.forEach((block) => observer.observe(block));
    return () => observer.disconnect();
  });

  return ref;
}
