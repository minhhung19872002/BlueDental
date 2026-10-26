import { APPOINTMENT_STATUSES, type AppointmentStatus } from "../types/appointment";

/**
 * The reference's four groups, as the edit dialog's Trạng thái select names
 * them. Both "Đã hẹn" statuses and both "Đã đến" statuses read the same.
 */
const GROUP_LABEL: Record<AppointmentStatus, string> = {
  scheduled: "Appointment:Status:Scheduled2",
  confirmed: "Appointment:Status:Scheduled2",
  inProgress: "Appointment:Status:Arrived",
  completed: "Appointment:Status:Arrived",
  cancelled: "Appointment:Status:CancelledAlt",
  noShow: "Appointment:Status:Late",
};

/**
 * The one status that stands for each group in the select. The form holds
 * the group, so a confirmed appointment opens on "Đã hẹn" and, saved
 * untouched, asks the server for nothing new.
 */
export const STATUS_GROUP: Record<AppointmentStatus, AppointmentStatus> = {
  scheduled: "scheduled",
  confirmed: "scheduled",
  inProgress: "inProgress",
  completed: "inProgress",
  cancelled: "cancelled",
  noShow: "noShow",
};

/** Offered to a visit that never arrived: booked, cancelled or late. */
const NOT_ARRIVED_OFFERED: readonly AppointmentStatus[] = ["scheduled", "cancelled", "noShow"];

/**
 * Offered to a visit with an arrival time, even one cancelled since: it can
 * be cancelled or put back to Đã đến, never back on the book nor late (R-1034).
 */
const ARRIVED_OFFERED: readonly AppointmentStatus[] = ["inProgress", "cancelled"];

/** The appointment as stored, as far as the Trạng thái select cares. */
export interface StoredStatus {
  status: AppointmentStatus;
  /** The patient was checked in — the visit has an arrival time. */
  arrived: boolean;
}

interface StatusOption {
  value: AppointmentStatus;
  /** Untranslated; the field runs it through t() when it renders. */
  label: string;
}

/**
 * In workflow order. A visit that never arrived gets Đã hẹn, Đã huỷ and Trễ
 * hẹn, so a cancelled or late one can be put back on the book from the same
 * select. A visit that arrived gets Đã đến and Đã huỷ: reception records
 * arrivals, the dialog only undoes a cancel. The current value is always
 * there, so a legacy late visit with an arrival time still opens on it.
 */
export function statusSelectOptions(stored: StoredStatus): StatusOption[] {
  const base = stored.arrived ? ARRIVED_OFFERED : NOT_ARRIVED_OFFERED;
  const offered = new Set<AppointmentStatus>([...base, STATUS_GROUP[stored.status]]);
  return APPOINTMENT_STATUSES.filter((status) => offered.has(status)).map((value) => ({
    value,
    label: GROUP_LABEL[value],
  }));
}
