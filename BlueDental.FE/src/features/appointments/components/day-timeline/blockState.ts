import dayjs from "dayjs";
import type { AppointmentDto } from "../../types/appointment";

/**
 * What a block on the doctor timeline shows (BA 2026-10-03):
 * đang khám vàng, sắp xong xanh dương, quá giờ đỏ, đã khám xám, khách đang chờ
 * viền răng cưa — "khách đang chờ" being a patient who has checked in but not
 * yet been seen.
 */
export type BlockState =
  | "booked"
  | "waiting"
  | "inProgress"
  | "nearlyDone"
  | "overdue"
  | "done"
  | "noShow";

/** How close to its planned end a visit reads as "sắp xong". */
const NEARLY_DONE_MINUTES = 10;

export function blockStateOf(appointment: AppointmentDto, now: number): BlockState {
  switch (appointment.status) {
    case "completed":
      return "done";
    case "noShow":
      return "noShow";
    case "inProgress": {
      // The screens fold CheckedIn into inProgress; startedAt tells them apart.
      if (!appointment.startedAt) return "waiting";
      const minutesLeft = dayjs(appointment.endTime).diff(now, "minute", true);
      if (minutesLeft < 0) return "overdue";
      if (minutesLeft <= NEARLY_DONE_MINUTES) return "nearlyDone";
      return "inProgress";
    }
    default:
      return "booked";
  }
}

/** Legend order, left to right. */
export const BLOCK_STATES: readonly BlockState[] = [
  "done",
  "inProgress",
  "nearlyDone",
  "overdue",
  "waiting",
  "booked",
  "noShow",
];

export const BLOCK_STATE_LABEL_KEY: Record<BlockState, string> = {
  booked: "Appointment:Timeline:Booked",
  waiting: "Appointment:Timeline:Waiting",
  inProgress: "Appointment:Timeline:InProgress",
  nearlyDone: "Appointment:Timeline:NearlyDone",
  overdue: "Appointment:Timeline:Overdue",
  done: "Appointment:Timeline:Done",
  noShow: "Appointment:Timeline:NoShow",
};
