import { useEffect, useState } from "react";

/**
 * The current time in epoch milliseconds, refreshed every `intervalMs` while
 * `enabled`. Disabled, it holds its last value and runs no timer.
 */
export function useNow(enabled: boolean, intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!enabled) return;
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [enabled, intervalMs]);

  return now;
}
