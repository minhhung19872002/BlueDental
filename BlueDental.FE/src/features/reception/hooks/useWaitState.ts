import { useNow } from "@/hooks/useNow";
import type { ReceptionItem } from "../types/reception";
import { getWaitState, isWaiting, type WaitState } from "../utils/waitTime";

/** The card's wait clock: ticks every second only while the patient waits. */
export function useWaitState(item: ReceptionItem): WaitState {
  const input = {
    checkedInAt: item.checkedInAt,
    startedAt: item.startedAt,
    cancelled: item.counterStatus === "Cancelled",
  };
  const now = useNow(isWaiting(input));
  return getWaitState(input, now);
}
