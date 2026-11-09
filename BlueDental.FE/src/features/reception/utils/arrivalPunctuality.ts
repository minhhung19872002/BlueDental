import dayjs from "dayjs";

/** How far off the booked time the patient pressed "Đã đến": whole days apart, else minutes. */
export type PunctualitySpan = { unit: "days"; value: number } | { unit: "minutes"; value: number };

/** Late or early (R-1183); a patient on the booked minute has none. */
export interface ArrivalPunctuality {
  direction: "late" | "early";
  span: PunctualitySpan;
}

/**
 * Compares "Đã đến" with the booked time on the clock reception reads (HH:mm,
 * seconds dropped), so booked 17:15 and arrived 17:23:59 is 8 minutes late.
 * Owner 2026-11-09: no tolerance — any minute off counts; a visit checked in on
 * another day than booked counts whole calendar days.
 */
export function getArrivalPunctuality(slotStart: string, checkedInAt?: string): ArrivalPunctuality | null {
  if (!checkedInAt) return null;
  const booked = dayjs(slotStart).startOf("minute");
  const arrived = dayjs(checkedInAt).startOf("minute");

  const days = arrived.startOf("day").diff(booked.startOf("day"), "day");
  if (days !== 0) {
    return { direction: days > 0 ? "late" : "early", span: { unit: "days", value: Math.abs(days) } };
  }

  const minutes = arrived.diff(booked, "minute");
  if (minutes === 0) return null;
  return { direction: minutes > 0 ? "late" : "early", span: { unit: "minutes", value: Math.abs(minutes) } };
}
