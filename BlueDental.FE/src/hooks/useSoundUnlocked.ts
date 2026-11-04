import { useSyncExternalStore } from "react";
import { isSoundUnlocked, subscribeSoundUnlocked } from "@/lib/chime";

/**
 * Whether the browser lets the page make sound yet: false from a fresh load or
 * F5 until the viewer's first click or key press anywhere on the page.
 */
export function useSoundUnlocked(): boolean {
  return useSyncExternalStore(subscribeSoundUnlocked, isSoundUnlocked);
}
