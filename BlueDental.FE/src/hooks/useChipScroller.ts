import { useCallback, useEffect, useRef, useState } from "react";

/** How far one arrow press slides the strip, as on the reference. */
const STEP_PX = 280;
/** The smooth scroll settles before the arrows are read again. */
const SETTLE_MS = 260;
/** A couple of px of slack so a sub-pixel scroll does not flicker an arrow. */
const SLACK_PX = 2;
/** The reference asks for its next page once the strip is this close to its end. */
const NEAR_END_PX = 96;

export interface ChipScroller {
  ref: React.RefObject<HTMLDivElement | null>;
  canPrev: boolean;
  canNext: boolean;
  onScroll: () => void;
  prev: () => void;
  next: () => void;
}

/**
 * The reference's two-row chip carousel: the strip scrolls sideways, and a
 * round arrow on each side slides it 280px; each arrow greys out once its
 * side has nothing left to show. Read again on scroll, on resize and
 * whenever the chip count changes.
 *
 * `onNearEnd` is for a strip that pages its options in: the reference calls
 * for the next page once a scroll leaves less than 96px to the right edge.
 */
export function useChipScroller(itemCount: number, onNearEnd?: () => void): ChipScroller {
  const ref = useRef<HTMLDivElement>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setCanPrev(el.scrollLeft > SLACK_PX);
    setCanNext(el.scrollLeft + el.clientWidth < el.scrollWidth - SLACK_PX);
  }, []);

  const handleScroll = useCallback(() => {
    const el = ref.current;
    if (el && onNearEnd && el.scrollWidth - el.scrollLeft - el.clientWidth <= NEAR_END_PX) onNearEnd();
    measure();
  }, [measure, onNearEnd]);

  useEffect(() => {
    measure();
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [measure, itemCount]);

  const slide = useCallback(
    (direction: -1 | 1) => {
      ref.current?.scrollBy({ left: direction * STEP_PX, behavior: "smooth" });
      window.setTimeout(measure, SETTLE_MS);
    },
    [measure],
  );

  return {
    ref,
    canPrev,
    canNext,
    onScroll: handleScroll,
    prev: () => slide(-1),
    next: () => slide(1),
  };
}
