import { useNow } from "@/hooks/useNow";
import type { ReceptionItem } from "../types/reception";
import { isCancelledVisit } from "../utils/receptionFlow";
import { getWaitState, isWaiting, type WaitInput, type WaitState } from "../utils/waitTime";

/** A wait clock that ticks every second only while the patient waits. */
export function useWaitClock(input: WaitInput): WaitState {
  const now = useNow(isWaiting(input));
  return getWaitState(input, now);
}

/** The card's wait clock. */
export function useWaitState(item: ReceptionItem): WaitState {
  return useWaitClock({
    checkedInAt: item.checkedInAt,
    startedAt: item.startedAt,
    cancelled: isCancelledVisit(item),
  });
}
