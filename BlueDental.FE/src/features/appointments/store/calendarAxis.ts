import { WINDOW_STEP_MINUTES, type CalendarWindow, type TimeRange } from "./calendarWindowStore";

const DAY_MINUTES = 24 * 60;

/**
 * The time axis a calendar draws for the viewer's window (R-977) on its slot
 * length, with the breaks folded out (R-1005): `slots` skips every slot lying
 * wholly inside a break, and positions are counted in shown minutes only, so
 * 11:45 sits right above 13:00. On a 30' grid a break off the half hour keeps
 * the slot it only partly covers.
 */
export interface CalendarAxis {
  /** First slot's start. */
  startMinute: number;
  /** Last slot's end, never past midnight. */
  endMinute: number;
  slotMinutes: number;
  /** Starts of the slots drawn, earliest first. */
  slots: number[];
  /** Folded-out spans, earliest first, touching ones joined. */
  hidden: TimeRange[];
}

/**
 * The grid edges for a slot length: from the first slot to the end of the
 * last one, whole slots only (a 30' grid from 08:15 to 18:45 runs to 19:15),
 * never past midnight.
 */
function gridEdges(range: CalendarWindow, slotMinutes: number): { startMinute: number; endMinute: number } {
  const span = range.toMinute + WINDOW_STEP_MINUTES - range.fromMinute;
  const endMinute = range.fromMinute + Math.ceil(span / slotMinutes) * slotMinutes;
  return { startMinute: range.fromMinute, endMinute: Math.min(endMinute, DAY_MINUTES) };
}

export function buildAxis(range: CalendarWindow, slotMinutes: number): CalendarAxis {
  const { startMinute, endMinute } = gridEdges(range, slotMinutes);
  const slots: number[] = [];
  const hidden: TimeRange[] = [];
  for (let minute = startMinute; minute < endMinute; minute += slotMinutes) {
    const end = Math.min(minute + slotMinutes, endMinute);
    const inBreak = range.breaks.some((b) => b.fromMinute <= minute && end <= b.toMinute);
    if (!inBreak) {
      slots.push(minute);
      continue;
    }
    const last = hidden[hidden.length - 1];
    if (last && last.toMinute === minute) last.toMinute = end;
    else hidden.push({ fromMinute: minute, toMinute: end });
  }
  return { startMinute, endMinute, slotMinutes, slots, hidden };
}

/** Where `minute` sits on the axis, in shown minutes from its top; a folded minute sits on the fold. */
export function shownOffset(axis: CalendarAxis, minute: number): number {
  const at = Math.min(Math.max(minute, axis.startMinute), axis.endMinute);
  let offset = at - axis.startMinute;
  for (const span of axis.hidden) {
    offset -= Math.max(0, Math.min(at, span.toMinute) - span.fromMinute);
  }
  return offset;
}

/** Shown minutes from the axis' top to its bottom. */
export function shownLength(axis: CalendarAxis): number {
  return shownOffset(axis, axis.endMinute);
}

/** Whether `minute` falls in a folded-out break. */
export function isFolded(axis: CalendarAxis, minute: number): boolean {
  return axis.hidden.some((span) => span.fromMinute <= minute && minute < span.toMinute);
}

/**
 * A booking's place on the axis in shown minutes, or null when none of it is
 * shown — outside the window or wholly inside a break. One running across a
 * break stays a single block, shortened by the folded part.
 */
export function placeOnAxis(
  axis: CalendarAxis,
  startMinute: number,
  endMinute: number,
): { offset: number; length: number } | null {
  const offset = shownOffset(axis, startMinute);
  const length = shownOffset(axis, endMinute) - offset;
  return length > 0 ? { offset, length } : null;
}
