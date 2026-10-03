import dayjs from "dayjs";

/** BA: under 5 minutes green, from 5 yellow, from 10 red. */
const WARNING_AFTER_SECONDS = 5 * 60;
const OVERDUE_AFTER_SECONDS = 10 * 60;

export type WaitLevel = "normal" | "warning" | "overdue";

/**
 * How long the patient has waited between "Đã đến" and "Đang khám".
 * `waiting` ticks live; `waited` is the total, frozen once the chair took them.
 */
export type WaitState =
  | { kind: "none" }
  | { kind: "waiting"; level: WaitLevel; elapsedSeconds: number }
  | { kind: "waited"; minutes: number };

export interface WaitInput {
  /** ISO instants as the server stamped them. */
  checkedInAt?: string;
  startedAt?: string;
  cancelled: boolean;
}

/** Whether the visit is in the stretch the live clock runs over. */
export function isWaiting({ checkedInAt, startedAt, cancelled }: WaitInput): boolean {
  return !!checkedInAt && !startedAt && !cancelled;
}

function levelOf(elapsedSeconds: number): WaitLevel {
  if (elapsedSeconds >= OVERDUE_AFTER_SECONDS) return "overdue";
  if (elapsedSeconds >= WARNING_AFTER_SECONDS) return "warning";
  return "normal";
}

export function getWaitState(input: WaitInput, now: number): WaitState {
  const { checkedInAt, startedAt } = input;
  if (!checkedInAt) return { kind: "none" };

  const arrived = dayjs(checkedInAt);
  if (startedAt) {
    // Clamped: a clock skew between the stamps must not show a negative wait.
    const minutes = Math.max(0, dayjs(startedAt).diff(arrived, "minute"));
    return { kind: "waited", minutes };
  }

  // A check-in left over from an earlier day is not a wait in progress.
  if (!isWaiting(input) || !arrived.isSame(now, "day")) return { kind: "none" };

  const elapsedSeconds = Math.max(0, Math.floor((now - arrived.valueOf()) / 1000));
  return { kind: "waiting", level: levelOf(elapsedSeconds), elapsedSeconds };
}

const pad = (value: number) => String(value).padStart(2, "0");

/** mm:ss, or h:mm:ss past the hour. */
export function formatElapsed(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;
}
