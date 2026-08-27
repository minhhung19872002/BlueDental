import { useEffect, useRef, useState } from "react";

/**
 * Whether the element the returned ref is on has scrolled out of view upwards.
 *
 * Screens that swap a tall toolbar for a compact sticky one need to know when
 * the tall one has gone; an IntersectionObserver on a sentinel answers that
 * without a scroll handler running on every frame.
 *
 * @param rootMargin Shrinks the viewport from the top, so a fixed app header
 * counts as "already covered" rather than the sentinel hiding behind it.
 */
export function useScrolledPast(rootMargin = "0px") {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [past, setPast] = useState(false);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        // Off the top, not merely off screen: scrolling the sentinel below the
        // viewport (which never happens here) must not count as passed.
        setPast(!entry.isIntersecting && entry.boundingClientRect.top < 0);
      },
      { rootMargin, threshold: 0 },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [rootMargin]);

  return { sentinelRef, past };
}
