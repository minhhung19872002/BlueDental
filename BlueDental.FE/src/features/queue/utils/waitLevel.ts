import { getLocale } from "@/lib/i18n";

/** Mirrors BlueDental.Queue.QueueWaitLevels on the server. */
export type WaitLevel = "normal" | "warning" | "danger";

/** From 70% of the counter's threshold a wait turns amber; past the threshold, red. */
const WARNING_SHARE = 0.7;

export function waitLevelOf(waitedMinutes: number, thresholdMinutes: number): WaitLevel {
  if (waitedMinutes > thresholdMinutes) return "danger";
  if (waitedMinutes >= thresholdMinutes * WARNING_SHARE) return "warning";
  return "normal";
}

export const WAIT_LEVELS: readonly WaitLevel[] = ["normal", "warning", "danger"];

export const WAIT_LEVEL_LABEL: Record<WaitLevel, string> = {
  normal: "Queue:Wait:Normal",
  warning: "Queue:Wait:Warning",
  danger: "Queue:Wait:Danger",
};

/** "08:42" in the viewer's locale. */
export function formatClock(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return new Date(value).toLocaleTimeString(getLocale(), { hour: "2-digit", minute: "2-digit" });
}

/** Whole minutes from `since` to `now`, never negative. */
export function minutesSince(since: string | null | undefined, now: number): number {
  if (!since) return 0;
  return Math.max(0, Math.floor((now - new Date(since).getTime()) / 60_000));
}
