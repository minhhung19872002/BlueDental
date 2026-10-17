import dayjs from "dayjs";
import type { AppointmentDto } from "../../types/appointment";
import { clipToGrid, gridEdges, type CalendarWindow } from "../../store/calendarWindowStore";

const LAST_MINUTE = 24 * 60;

/**
 * Height of one slot on the time axis, by slot length. Tall enough that a
 * 15-minute booking still shows the patient's name on one line.
 */
const SLOT_HEIGHT_PX: Record<15 | 30, number> = { 15: 40, 30: 48 };

/** Height of the sticky header row carrying the doctors' names. */
export const HEAD_HEIGHT_PX = 40;

export interface TimeScale {
  startMinute: number;
  endMinute: number;
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
 * The viewer's display window (R-977). A booking outside it no longer widens
 * the axis: it is cut at the edges, or left out (`placeBlocks`).
 */
export function buildTimeScale(range: CalendarWindow, slotMinutes: 15 | 30): TimeScale {
  const { startMinute, endMinute } = gridEdges(range, slotMinutes);
  return { startMinute, endMinute, slotMinutes, pxPerMinute: SLOT_HEIGHT_PX[slotMinutes] / slotMinutes };
}

export function trackHeight(scale: TimeScale): number {
  return (scale.endMinute - scale.startMinute) * scale.pxPerMinute;
}

export function minuteToY(scale: TimeScale, minute: number): number {
  return (minute - scale.startMinute) * scale.pxPerMinute;
}

export function formatMinute(minute: number): string {
  const h = Math.floor(minute / 60).toString().padStart(2, "0");
  const m = (minute % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

/** Slot start minutes across the scale. */
export function slotStarts(scale: TimeScale): number[] {
  const starts: number[] = [];
  for (let m = scale.startMinute; m < scale.endMinute; m += scale.slotMinutes) starts.push(m);
  return starts;
}

export interface PlacedBlock {
  appointment: AppointmentDto;
  top: number;
  height: number;
  lane: number;
}

export interface PlacedColumn {
  blocks: PlacedBlock[];
  laneCount: number;
}

/**
 * Lays one doctor's bookings down the axis, cut to the hours shown. Overlapping bookings go to
 * side-by-side lanes (first lane that is free again), so none hides another.
 */
export function placeBlocks(appointments: AppointmentDto[], scale: TimeScale): PlacedColumn {
  const sorted = [...appointments].sort((a, b) => dayjs(a.startTime).valueOf() - dayjs(b.startTime).valueOf());
  const laneEnds: number[] = [];
  const blocks: PlacedBlock[] = [];

  for (const appointment of sorted) {
    const own = minuteOfDay(appointment.startTime);
    const shown = clipToGrid(own, Math.max(endMinuteOf(appointment), own + 1), scale);
    if (!shown) continue;
    const { startMinute: start, endMinute: end } = shown;
    let lane = laneEnds.findIndex((laneEnd) => laneEnd <= start);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(end);
    } else {
      laneEnds[lane] = end;
    }
    blocks.push({
      appointment,
      lane,
      top: minuteToY(scale, start),
      height: (end - start) * scale.pxPerMinute,
    });
  }

  return { blocks, laneCount: Math.max(1, laneEnds.length) };
}
