import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { ReceptionItem } from "../types/reception";

/** Just past the start time, so the refetch sees the booking as late. */
const AFTER_START_MS = 1_000;
/** Far-off bookings are re-checked on the next refetch rather than held in one long timer. */
const MAX_WAIT_MS = 60 * 60_000;

/**
 * Refetches the board right after the next booked start time, so a booking
 * turns Trễ hẹn on time even between the server's passes or if its push is
 * missed (owner 2026-10-06: late as soon as the time passes, no reload).
 */
export function useRefetchWhenDue(items: ReceptionItem[]): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    const now = Date.now();
    const nextStart = items
      .filter((item) => item.visitStatus === "Scheduled" && item.arrivalTime)
      .map((item) => Date.parse(item.arrivalTime))
      .filter((start) => start > now)
      .reduce((soonest, start) => Math.min(soonest, start), Infinity);
    if (nextStart === Infinity) return;

    const timer = window.setTimeout(() => {
      void queryClient.invalidateQueries({ queryKey: ["receptions"] });
      void queryClient.invalidateQueries({ queryKey: ["receptionMetrics"] });
    }, Math.min(nextStart - now + AFTER_START_MS, MAX_WAIT_MS));
    return () => window.clearTimeout(timer);
  }, [items, queryClient]);
}
