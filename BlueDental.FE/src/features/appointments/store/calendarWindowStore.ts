import { create } from "zustand";

/**
 * The hours the calendars show (R-977). The owner (2026-10-17): every viewer
 * sets them for themselves, they live in this browser only, and the day view,
 * the week view and "Lịch đã hẹn" all share one window. Bookings outside it
 * are not shown — whoever needs them widens the window.
 *
 * `fromMinute` is the first slot, `toMinute` the last one shown: "08:00 –
 * 18:45" ends the grid at 19:00, so the 18:45 slot is still there.
 */
export interface CalendarWindow {
  fromMinute: number;
  toMinute: number;
}

export const WINDOW_STEP_MINUTES = 15;
export const DEFAULT_CALENDAR_WINDOW: CalendarWindow = { fromMinute: 8 * 60, toMinute: 18 * 60 + 45 };

const DAY_MINUTES = 24 * 60;
const STORAGE_KEY = "bd_calendar_window";

export function isValidWindow(range: CalendarWindow): boolean {
  const onStep = (m: number) => Number.isInteger(m) && m % WINDOW_STEP_MINUTES === 0;
  return onStep(range.fromMinute) && onStep(range.toMinute)
    && range.fromMinute >= 0 && range.toMinute < DAY_MINUTES
    && range.fromMinute < range.toMinute;
}

function isWindowShape(value: unknown): value is CalendarWindow {
  if (typeof value !== "object" || value === null) return false;
  const { fromMinute, toMinute } = value as Record<string, unknown>;
  return typeof fromMinute === "number" && typeof toMinute === "number";
}

function readStored(): CalendarWindow {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    return isWindowShape(parsed) && isValidWindow(parsed) ? parsed : DEFAULT_CALENDAR_WINDOW;
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
    if (!isValidWindow(range)) return;
    writeStored(range);
    set({ range });
  },
}));

/**
 * The grid edges for a slot length: from the first slot to the end of the
 * last one, whole slots only (a 30' grid from 08:15 to 18:45 runs to 19:15),
 * never past midnight.
 */
export function gridEdges(range: CalendarWindow, slotMinutes: number): { startMinute: number; endMinute: number } {
  const span = range.toMinute + WINDOW_STEP_MINUTES - range.fromMinute;
  const endMinute = range.fromMinute + Math.ceil(span / slotMinutes) * slotMinutes;
  return { startMinute: range.fromMinute, endMinute: Math.min(endMinute, DAY_MINUTES) };
}

/** A booking cut to the grid, or null when it falls wholly outside it. */
export function clipToGrid(
  startMinute: number,
  endMinute: number,
  grid: { startMinute: number; endMinute: number },
): { startMinute: number; endMinute: number } | null {
  const start = Math.max(startMinute, grid.startMinute);
  const end = Math.min(endMinute, grid.endMinute);
  return end > start ? { startMinute: start, endMinute: end } : null;
}
