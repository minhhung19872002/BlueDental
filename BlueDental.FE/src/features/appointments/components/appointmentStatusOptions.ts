import { APPOINTMENT_STATUSES, type AppointmentStatus } from "../types/appointment";

/**
 * The reference's four groups, as the edit dialog's Trạng thái select names
 * them. Both "Đã hẹn" statuses and both "Đã đến" statuses read the same.
 */
const GROUP_LABEL: Record<AppointmentStatus, string> = {
  scheduled: "Đã hẹn",
  confirmed: "Đã hẹn",
  inProgress: "Đã đến",
  completed: "Đã đến",
  cancelled: "Đã huỷ",
  noShow: "Trễ hẹn",
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

/** Offered whatever the appointment is now: booked, cancelled or late. */
const ALWAYS_OFFERED: readonly AppointmentStatus[] = ["scheduled", "cancelled", "noShow"];

interface StatusOption {
  value: AppointmentStatus;
  /** Untranslated; the field runs it through t() when it renders. */
  label: string;
}

/**
 * Đã hẹn, Đã huỷ and Trễ hẹn are always there, in workflow order, so a
 * cancelled or late appointment can be put back on the book from the same
 * select. "Đã đến" appears only as the current value of a visit that
 * arrived: reception records arrivals, the dialog never does.
 */
export function statusSelectOptions(current: AppointmentStatus): StatusOption[] {
  const offered = new Set<AppointmentStatus>([...ALWAYS_OFFERED, STATUS_GROUP[current]]);
  return APPOINTMENT_STATUSES.filter((status) => offered.has(status)).map((value) => ({
    value,
    label: GROUP_LABEL[value],
  }));
}
