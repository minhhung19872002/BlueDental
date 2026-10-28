import type { Dayjs } from "dayjs";
import { startOfWeek } from "@/utils/week";
import type { BusySpan, DoctorWorkDay, MinuteSpan } from "../types/reception";

/** The timeline snaps to a quarter hour; the Từ / Đến steppers move by one. */
export const STEP_MINUTES = 15;

/** A click without a drag, and a quick pick, take half an hour. */
export const DEFAULT_MINUTES = 30;

/** The length chips under the timeline. */
export const DURATIONS = [30, 45, 60, 90] as const;

const DAY_MINUTES = 24 * 60;
const MINUTE_MS = 60_000;

export type QuickPickKey = "1w" | "2w" | "3w" | "1m";

export const QUICK_PICKS: { key: QuickPickKey; amount: number; unit: "week" | "month" }[] = [
  { key: "1w", amount: 1, unit: "week" },
  { key: "2w", amount: 2, unit: "week" },
  { key: "3w", amount: 3, unit: "week" },
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

/** 510 → "08:30". */
export function hhmm(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

/** The instant `minutes` past midnight of `day`. */
export function atMinute(day: Dayjs, minutes: number): Dayjs {
  return day.startOf("day").add(minutes, "minute");
}

function clip(spans: MinuteSpan[], to: MinuteSpan): MinuteSpan[] {
  return spans
    .map((s) => ({ start: Math.max(s.start, to.start), end: Math.min(s.end, to.end) }))
    .filter((s) => s.end > s.start);
}

/** Sorted, with overlapping and touching spans joined. */
function merge(spans: MinuteSpan[]): MinuteSpan[] {
  const merged: MinuteSpan[] = [];
  for (const s of [...spans].sort((a, b) => a.start - b.start)) {
    const last = merged[merged.length - 1];
    if (last && s.start <= last.end) last.end = Math.max(last.end, s.end);
    else merged.push({ ...s });
  }
  return merged;
}

/** What is left of `span` once `holes` are taken out of it. */
function subtract(span: MinuteSpan, holes: MinuteSpan[]): MinuteSpan[] {
  const left: MinuteSpan[] = [];
  let from = span.start;
  for (const h of merge(clip(holes, span))) {
    if (h.start > from) left.push({ start: from, end: h.start });
    from = Math.max(from, h.end);
  }
  if (from < span.end) left.push({ start: from, end: span.end });
  return left;
}

/** The doctor's bookings that fall on `day`, as minutes of that day. */
export function bookedOn(day: Dayjs, busy: BusySpan[]): MinuteSpan[] {
  const midnight = day.startOf("day").valueOf();
  const spans = busy.map((b) => ({
    start: Math.round((b.start - midnight) / MINUTE_MS),
    end: Math.round((b.end - midnight) / MINUTE_MS),
  }));
  return clip(spans, { start: 0, end: DAY_MINUTES });
}

/**
 * What of the doctor's day a follow-up may take: the working windows on the
 * quarter hour, and only from the next quarter hour on when the day is today.
 */
const snapUp = (m: number) => Math.ceil(m / STEP_MINUTES) * STEP_MINUTES;
const snapDown = (m: number) => Math.floor(m / STEP_MINUTES) * STEP_MINUTES;

/** Spans trimmed to the quarter hour, dropping any left shorter than one. */
function onQuarterHours(spans: MinuteSpan[]): MinuteSpan[] {
  return spans
    .map((s) => ({ start: snapUp(s.start), end: snapDown(s.end) }))
    .filter((s) => s.end - s.start >= STEP_MINUTES);
}

export function openWindows(day: Dayjs, workDay: DoctorWorkDay, now: number): MinuteSpan[] {
  const sinceMidnight = Math.ceil((now - day.startOf("day").valueOf()) / MINUTE_MS);
  const earliest = Math.max(0, Math.min(DAY_MINUTES, sinceMidnight));
  return onQuarterHours(workDay.windows.map((w) => ({ start: Math.max(w.start, earliest), end: w.end })));
}

/**
 * What a range may be picked in: the open windows less the doctor's bookings
 * (owner 2026-10-28: no picking over a booked visit), on the quarter hour.
 */
export function freeStretches(open: MinuteSpan[], booked: MinuteSpan[]): MinuteSpan[] {
  return onQuarterHours(open.flatMap((w) => subtract(w, booked)));
}

/** The stretch holding minute `m`. */
export function windowAt(stretches: MinuteSpan[], m: number): MinuteSpan | undefined {
  return stretches.find((w) => w.start <= m && m < w.end);
}

/** Whether the range sits inside one of the stretches and lasts a step at least. */
export function fitsIn(stretches: MinuteSpan[], range: MinuteSpan): boolean {
  return range.end - range.start >= STEP_MINUTES && stretches.some((w) => w.start <= range.start && range.end <= w.end);
}

/** The first free half hour — where a quick pick lands. */
export function firstFreeRange(free: MinuteSpan[]): MinuteSpan | undefined {
  const stretch = free.find((w) => w.end - w.start >= DEFAULT_MINUTES);
  return stretch && { start: stretch.start, end: stretch.start + DEFAULT_MINUTES };
}

/** Minutes left to book in the free stretches. */
export function freeMinutes(free: MinuteSpan[]): number {
  return free.reduce((sum, s) => sum + s.end - s.start, 0);
}

/**
 * past — gone, or today with nothing left; off — the doctor's day off;
 * full — every open quarter hour is booked; unknown — no doctor, or the
 * shifts are on their way.
 */
export type DayState = "past" | "off" | "full" | "free" | "unknown";

export function dayState(day: Dayjs, workDay: DoctorWorkDay | undefined, open: MinuteSpan[], free: number, now: number): DayState {
  if (day.endOf("day").valueOf() < now) return "past";
  if (!workDay) return "unknown";
  if (workDay.windows.length === 0) return "off";
  if (open.length === 0) return "past";
  return free > 0 ? "free" : "full";
}

/** A full day has nothing left to pick, now that booked visits cannot be picked over. */
export function isPickable(state: DayState): boolean {
  return state === "free" || state === "unknown";
}

export type SessionKey = "morning" | "afternoon";

/** One timeline: a planned shift, what of it is open, out of it, and booked. */
export interface SessionTrack {
  key: SessionKey;
  span: MinuteSpan;
  /** False when leave or a day off takes the whole shift; true when only time has run out. */
  working: boolean;
  open: MinuteSpan[];
  /** Drawn hatched as "Ngoài ca": leave, the past, minutes off the quarter hour. */
  closed: MinuteSpan[];
  booked: MinuteSpan[];
  /** Where a range may go: the open stretches less the bookings. */
  free: MinuteSpan[];
}

export function sessionTracks(
  workDay: DoctorWorkDay,
  open: MinuteSpan[],
  booked: MinuteSpan[],
  free: MinuteSpan[],
): SessionTrack[] {
  const track = (key: SessionKey, span: MinuteSpan): SessionTrack => {
    const inside = clip(open, span);
    return {
      key,
      span,
      working: clip(workDay.windows, span).length > 0,
      open: inside,
      closed: subtract(span, inside),
      booked: clip(booked, span),
      free: onQuarterHours(clip(free, span)),
    };
  };
  return [track("morning", workDay.morning), track("afternoon", workDay.afternoon)];
}

/** Consecutive days sharing the same hours, for "Ca làm việc: T2–T6 …". */
export interface ShiftRun {
  first: number;
  last: number;
  windows: MinuteSpan[];
}

export function shiftRuns(workDays: (DoctorWorkDay | undefined)[]): ShiftRun[] {
  const runs: (ShiftRun & { hours: string })[] = [];
  workDays.forEach((day, i) => {
    if (!day) return;
    const hours = day.windows.map((w) => `${w.start}-${w.end}`).join(",");
    const last = runs[runs.length - 1];
    if (last && last.last === i - 1 && last.hours === hours) last.last = i;
    else runs.push({ first: i, last: i, windows: day.windows, hours });
  });
  return runs;
}
