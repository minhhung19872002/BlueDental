import dayjs from "dayjs";
import type { AppointmentDto } from "../../types/appointment";
import { buildAxis, placeOnAxis, shownLength, shownOffset, type CalendarAxis } from "../../store/calendarAxis";
import type { CalendarWindow } from "../../store/calendarWindowStore";

const LAST_MINUTE = 24 * 60;

/**
 * Height of one slot on the time axis, by slot length. Tall enough that a
 * 15-minute booking still shows the patient's name on one line.
 */
const SLOT_HEIGHT_PX: Record<15 | 30, number> = { 15: 40, 30: 48 };

/** Height of the sticky header row carrying the doctors' names. */
export const HEAD_HEIGHT_PX = 40;

export interface TimeScale extends CalendarAxis {
  slotMinutes: 15 | 30;
  pxPerMinute: number;
}

export function minuteOfDay(iso: string): number {
  const d = dayjs(iso);
  return d.hour() * 60 + d.minute();
}

/** End minute on the day being shown; a booking running past midnight stops at 24:00. */
function endMinuteOf(appointment: AppointmentDto): number {
  const start = dayjs(appointment.startTime);
  const end = dayjs(appointment.endTime);
  return end.isSame(start, "day") ? minuteOfDay(appointment.endTime) : LAST_MINUTE;
}

/**
 * The viewer's display window (R-977) with its breaks folded out (R-1005). A
 * booking outside it no longer widens the axis: it is cut at the edges, or
 * left out (`placeBlocks`).
 */
export function buildTimeScale(range: CalendarWindow, slotMinutes: 15 | 30): TimeScale {
  return { ...buildAxis(range, slotMinutes), slotMinutes, pxPerMinute: SLOT_HEIGHT_PX[slotMinutes] / slotMinutes };
}

export function trackHeight(scale: TimeScale): number {
  return shownLength(scale) * scale.pxPerMinute;
}

export function minuteToY(scale: TimeScale, minute: number): number {
  return shownOffset(scale, minute) * scale.pxPerMinute;
}

export function formatMinute(minute: number): string {
  const h = Math.floor(minute / 60).toString().padStart(2, "0");
  const m = (minute % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

export interface PlacedBlock {
  appointment: AppointmentDto;
  top: number;
  height: number;
  /** Lane inside its overlap group, counted from the left. */
  lane: number;
  /** Lanes its overlap group splits the column into (1 = the whole width). */
  lanes: number;
  /** Lanes it covers: it widens into lanes to its right that stay free while it runs. */
  span: number;
}

export interface PlacedColumn {
  blocks: PlacedBlock[];
  /** Most lanes any overlap group needs: sets the column's width. */
  laneCount: number;
}

interface Interval {
  appointment: AppointmentDto;
  start: number;
  end: number;
}

/** Each booking's start/end on the axis, earliest first; bookings outside the hours shown are left out. */
function intervalsOf(appointments: AppointmentDto[], scale: TimeScale): Interval[] {
  const intervals: Interval[] = [];
  for (const appointment of appointments) {
    const own = minuteOfDay(appointment.startTime);
    const shown = placeOnAxis(scale, own, Math.max(endMinuteOf(appointment), own + 1));
    if (shown) intervals.push({ appointment, start: shown.offset, end: shown.offset + shown.length });
  }
  return intervals.sort((a, b) => a.start - b.start || b.end - a.end);
}

/** Bookings chained by overlap, directly or through another one: each group shares its own lanes. */
function overlapGroups(intervals: Interval[]): Interval[][] {
  const groups: Interval[][] = [];
  let groupEnd = -1;
  for (const interval of intervals) {
    if (interval.start < groupEnd) {
      groups[groups.length - 1].push(interval);
      groupEnd = Math.max(groupEnd, interval.end);
    } else {
      groups.push([interval]);
      groupEnd = interval.end;
    }
  }
  return groups;
}

function overlaps(a: Interval, b: Interval): boolean {
  return a.start < b.end && b.start < a.end;
}

/** First free lane for each booking, then how far right each one may widen. */
function placeGroup(group: Interval[], pxPerMinute: number): PlacedBlock[] {
  const laneEnds: number[] = [];
  const laneOf = group.map((interval) => {
    const free = laneEnds.findIndex((laneEnd) => laneEnd <= interval.start);
    if (free === -1) return laneEnds.push(interval.end) - 1;
    laneEnds[free] = interval.end;
    return free;
  });
  const lanes = laneEnds.length;

  return group.map((interval, i) => {
    let span = 1;
    while (
      laneOf[i] + span < lanes &&
      !group.some((other, j) => laneOf[j] === laneOf[i] + span && overlaps(interval, other))
    ) {
      span++;
    }
    return {
      appointment: interval.appointment,
      top: interval.start * pxPerMinute,
      height: (interval.end - interval.start) * pxPerMinute,
      lane: laneOf[i],
      lanes,
      span,
    };
  });
}

/**
 * Lays one doctor's bookings down the axis, cut to the hours shown and folded
 * past the breaks. Bookings overlapping on screen go to side-by-side lanes
 * (first lane that is free again), so none hides another. Lanes are counted
 * per overlap group (R-1147): a booking nobody overlaps takes the whole
 * column, and one with lanes free to its right widens into them.
 */
export function placeBlocks(appointments: AppointmentDto[], scale: TimeScale): PlacedColumn {
  const blocks = overlapGroups(intervalsOf(appointments, scale)).flatMap((group) => placeGroup(group, scale.pxPerMinute));
  return { blocks, laneCount: Math.max(1, ...blocks.map((block) => block.lanes)) };
}
