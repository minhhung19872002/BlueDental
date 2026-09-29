import type { Dayjs } from "dayjs";
import { startOfWeek } from "@/utils/week";
import type { BusySpan } from "../types/reception";

/** Every follow-up slot is half an hour. */
export const SLOT_MINUTES = 30;

export interface SlotSession {
  key: "morning" | "afternoon";
  times: string[];
}

function halfHours(from: string, to: string): string[] {
  const toMinutes = (hhmm: string) => {
    const [h, m] = hhmm.split(":").map(Number);
    return h * 60 + m;
  };
  const times: string[] = [];
  for (let m = toMinutes(from); m <= toMinutes(to); m += SLOT_MINUTES) {
    times.push(`${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`);
  }
  return times;
}

/** From 08:00, every half hour, with the midday break left out. */
export const SLOT_SESSIONS: SlotSession[] = [
  { key: "morning", times: halfHours("08:00", "11:00") },
  { key: "afternoon", times: halfHours("13:30", "16:30") },
];

const ALL_TIMES = SLOT_SESSIONS.flatMap((s) => s.times);

export type QuickPickKey = "1w" | "2w" | "1m";

export const QUICK_PICKS: { key: QuickPickKey; amount: number; unit: "week" | "month" }[] = [
  { key: "1w", amount: 1, unit: "week" },
  { key: "2w", amount: 2, unit: "week" },
  { key: "1m", amount: 1, unit: "month" },
];

export function quickPickDate(today: Dayjs, key: QuickPickKey): Dayjs {
  const pick = QUICK_PICKS.find((p) => p.key === key) ?? QUICK_PICKS[0];
  return today.add(pick.amount, pick.unit).startOf("day");
}

/** The week strip always runs Monday → Sunday. */
export function mondayOf(date: Dayjs): Dayjs {
  return startOfWeek(date, 1);
}

export function weekDays(monday: Dayjs): Dayjs[] {
  return Array.from({ length: 7 }, (_, i) => monday.add(i, "day"));
}

export function slotAt(day: Dayjs, time: string): Dayjs {
  const [h, m] = time.split(":").map(Number);
  return day.hour(h).minute(m).second(0).millisecond(0);
}

export type SlotState = "free" | "busy" | "past";

export function slotState(day: Dayjs, time: string, busy: BusySpan[], now: number): SlotState {
  const start = slotAt(day, time).valueOf();
  if (start < now) return "past";
  const end = start + SLOT_MINUTES * 60_000;
  return busy.some((b) => b.start < end && b.end > start) ? "busy" : "free";
}

export function firstFreeTime(day: Dayjs, busy: BusySpan[], now: number): string | undefined {
  return ALL_TIMES.find((time) => slotState(day, time, busy, now) === "free");
}

export type DayState = "past" | "full" | "free";

export function dayState(day: Dayjs, busy: BusySpan[], now: number): DayState {
  if (day.endOf("day").valueOf() < now) return "past";
  return firstFreeTime(day, busy, now) ? "free" : "full";
}
