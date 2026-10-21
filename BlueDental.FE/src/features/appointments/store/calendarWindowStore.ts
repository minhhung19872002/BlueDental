import { create } from "zustand";

/**
 * The hours the calendars show (R-977). The owner (2026-10-17): every viewer
 * sets them for themselves, they live in this browser only, and the day view,
 * the week view and "Lịch đã hẹn" all share one window. Bookings outside it
 * are not shown — whoever needs them widens the window.
 *
 * `fromMinute` is the first slot, `toMinute` the last one shown: "08:00 –
 * 18:45" ends the grid at 19:00, so the 18:45 slot is still there.
 *
 * R-1005 (BA 2026-10-21): breaks fold out of the axis with no mark left
 * (11:45 is followed by 13:00). A break's `toMinute` is when work resumes,
 * so that slot is shown. By default the window has a 12:00–13:00 break, the
 * gap between the clinic's default morning and afternoon shifts.
 */
export interface TimeRange {
  fromMinute: number;
  toMinute: number;
}

export interface CalendarWindow extends TimeRange {
  /** Sorted, apart from each other, each inside the window. */
  breaks: TimeRange[];
}

/** Why a window cannot be applied; the break's index for a break problem. */
export type WindowProblem =
  | { kind: "order" }
  | { kind: "breakOrder" | "breakOutside" | "breakOverlap"; breakIndex: number };

export const WINDOW_STEP_MINUTES = 15;
export const DEFAULT_BREAK: TimeRange = { fromMinute: 12 * 60, toMinute: 13 * 60 };
export const DEFAULT_CALENDAR_WINDOW: CalendarWindow = {
  fromMinute: 8 * 60,
  toMinute: 18 * 60 + 45,
  breaks: [DEFAULT_BREAK],
};

const DAY_MINUTES = 24 * 60;
const STORAGE_KEY = "bd_calendar_window";

const onStep = (m: number) => Number.isInteger(m) && m >= 0 && m < DAY_MINUTES && m % WINDOW_STEP_MINUTES === 0;

/** A break must leave a slot of the window before it and resume inside it. */
function breakProblem(range: CalendarWindow, index: number): WindowProblem | null {
  const own = range.breaks[index];
  if (!onStep(own.fromMinute) || !onStep(own.toMinute) || own.fromMinute >= own.toMinute) {
    return { kind: "breakOrder", breakIndex: index };
  }
  if (own.fromMinute <= range.fromMinute || own.toMinute > range.toMinute) {
    return { kind: "breakOutside", breakIndex: index };
  }
  const overlaps = range.breaks.some(
    (other, i) => i < index && other.fromMinute < own.toMinute && own.fromMinute < other.toMinute,
  );
  return overlaps ? { kind: "breakOverlap", breakIndex: index } : null;
}

export function windowProblem(range: CalendarWindow): WindowProblem | null {
  if (!onStep(range.fromMinute) || !onStep(range.toMinute) || range.fromMinute >= range.toMinute) {
    return { kind: "order" };
  }
  for (let i = 0; i < range.breaks.length; i += 1) {
    const problem = breakProblem(range, i);
    if (problem) return problem;
  }
  return null;
}

export function isValidWindow(range: CalendarWindow): boolean {
  return windowProblem(range) === null;
}

/** Breaks earliest first, as the axis walks them. */
export function sortedWindow(range: CalendarWindow): CalendarWindow {
  return { ...range, breaks: [...range.breaks].sort((a, b) => a.fromMinute - b.fromMinute) };
}

function isRangeShape(value: unknown): value is TimeRange {
  if (typeof value !== "object" || value === null) return false;
  const { fromMinute, toMinute } = value as Record<string, unknown>;
  return typeof fromMinute === "number" && typeof toMinute === "number";
}

/**
 * A stored window, or null. One saved before R-1005 has no `breaks`: it takes
 * the default break when that fits inside it.
 */
function parseStored(value: unknown): CalendarWindow | null {
  if (!isRangeShape(value)) return null;
  const { breaks } = value as { breaks?: unknown };
  const window = { fromMinute: value.fromMinute, toMinute: value.toMinute };
  if (breaks === undefined) {
    const withDefault = { ...window, breaks: [DEFAULT_BREAK] };
    return isValidWindow(withDefault) ? withDefault : { ...window, breaks: [] };
  }
  if (!Array.isArray(breaks) || !breaks.every(isRangeShape)) return null;
  return sortedWindow({ ...window, breaks: breaks.map((b) => ({ fromMinute: b.fromMinute, toMinute: b.toMinute })) });
}

function readStored(): CalendarWindow {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = parseStored(raw ? JSON.parse(raw) : null);
    return parsed && isValidWindow(parsed) ? parsed : DEFAULT_CALENDAR_WINDOW;
  } catch {
    // No storage (private window, blocked site data): the default still works.
    return DEFAULT_CALENDAR_WINDOW;
  }
}

function writeStored(range: CalendarWindow): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(range));
  } catch {
    // Kept for this visit only; nothing else depends on it being stored.
  }
}

interface CalendarWindowState {
  range: CalendarWindow;
  setWindow: (range: CalendarWindow) => void;
}

export const useCalendarWindowStore = create<CalendarWindowState>((set) => ({
  range: readStored(),
  setWindow: (range) => {
    const sorted = sortedWindow(range);
    if (!isValidWindow(sorted)) return;
    writeStored(sorted);
    set({ range: sorted });
  },
}));
