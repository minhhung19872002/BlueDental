import { useEffect, useState } from "react";

const MINUTE_MS = 60_000;
/** Lands the timer just past :00 so a late-firing timeout never reads the old minute. */
const MINUTE_SLACK_MS = 20;

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

function floorToMinute(ms: number): number {
  return ms - (ms % MINUTE_MS);
}

/**
 * The current minute (epoch ms at its :00), for clocks drawn as HH:mm. It
 * changes exactly when the wall clock turns a minute — one timer aimed at the
 * next :00, never polling — and at once when the tab comes back into view,
 * since browsers throttle timers in hidden tabs. Within a minute the value is
 * the same number, so nothing depending on it renders again. Disabled, it
 * holds its last value and runs no timer.
 */
export function useMinuteNow(enabled: boolean): number {
  const [minute, setMinute] = useState(() => floorToMinute(Date.now()));

  useEffect(() => {
    if (!enabled) return;
    let timer = 0;
    const tick = () => {
      window.clearTimeout(timer);
      const now = Date.now();
      setMinute(floorToMinute(now));
      timer = window.setTimeout(tick, MINUTE_MS - (now % MINUTE_MS) + MINUTE_SLACK_MS);
    };
    const handleVisibility = () => {
      if (document.visibilityState === "visible") tick();
    };

    tick();
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [enabled]);

  return minute;
}
