import dayjs from "dayjs";
import type { AppointmentDto } from "../../types/appointment";

/**
 * The clinic's working hours (BA 2026-10-03: "7h - 20h").
 *
 * There is no shift master data yet; when one lands, this constant is the
 * single place to read it from.
 */
export const WORKING_HOURS = { startMinute: 7 * 60, endMinute: 20 * 60 } as const;

const LAST_MINUTE = 24 * 60;

/** Width of one slot on the time axis, by slot length. */
const SLOT_WIDTH_PX: Record<15 | 30, number> = { 15: 80, 30: 120 };

export const NAME_COL_WIDTH_PX = 220;

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
 * The working hours, widened to whole hours around any booking that falls
 * outside them, so no appointment is ever cut off the axis.
 */
export function buildTimeScale(appointments: AppointmentDto[], slotMinutes: 15 | 30): TimeScale {
  let startMinute: number = WORKING_HOURS.startMinute;
  let endMinute: number = WORKING_HOURS.endMinute;
  for (const appt of appointments) {
    startMinute = Math.min(startMinute, Math.floor(minuteOfDay(appt.startTime) / 60) * 60);
    endMinute = Math.max(endMinute, Math.min(LAST_MINUTE, Math.ceil(endMinuteOf(appt) / 60) * 60));
  }
  return { startMinute, endMinute, slotMinutes, pxPerMinute: SLOT_WIDTH_PX[slotMinutes] / slotMinutes };
}

export function trackWidth(scale: TimeScale): number {
  return (scale.endMinute - scale.startMinute) * scale.pxPerMinute;
}

export function minuteToX(scale: TimeScale, minute: number): number {
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
  left: number;
  width: number;
  lane: number;
}

export interface PlacedRow {
  blocks: PlacedBlock[];
  laneCount: number;
}

/**
 * Lays one doctor's bookings on the axis. Overlapping bookings go to separate
 * lanes (first lane that is free again), so none hides another.
 */
export function placeBlocks(appointments: AppointmentDto[], scale: TimeScale): PlacedRow {
  const sorted = [...appointments].sort((a, b) => dayjs(a.startTime).valueOf() - dayjs(b.startTime).valueOf());
  const laneEnds: number[] = [];
  const blocks: PlacedBlock[] = [];

  for (const appointment of sorted) {
    const start = minuteOfDay(appointment.startTime);
    const end = Math.max(endMinuteOf(appointment), start + 1);
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
      left: minuteToX(scale, start),
      width: (end - start) * scale.pxPerMinute,
    });
  }

  return { blocks, laneCount: Math.max(1, laneEnds.length) };
}
