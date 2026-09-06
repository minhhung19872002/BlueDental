import { useSyncExternalStore } from "react";

/**
 * Whether the viewport currently matches a CSS media query, tracked live.
 * Lets a component render one layout or the other instead of both with one
 * hidden, so the DOM (and its accessible names) only carries what is shown.
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}
