import type { MenuProps } from "antd";
import { t } from "@/lib/i18n";
import type { AppointmentDto } from "../types/appointment";

const EditIcon = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);

const CheckedBoxIcon = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
    <polyline points="9 11 12 14 22 4" />
  </svg>
);

const EmptyBoxIcon = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
  </svg>
);

const TrashIcon = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);

/**
 * A finished session of a "Lặp lại lịch hẹn" series stays as it was: the
 * server refuses to delete it (Appointment:0015), so the menu does not offer to.
 */
export function isFinishedSeriesSession(appointment: Pick<AppointmentDto, "seriesId" | "status">): boolean {
  return appointment.seriesId !== null && appointment.status === "completed";
}

/**
 * The ⋮ menu every appointment card offers: update, pick for multi-delete
 * (or drop the pick), delete. Keys are the actions the calendar page handles.
 */
export function buildAppointmentCardMenu(selected: boolean | undefined, undeletable = false): MenuProps["items"] {
  return [
    { key: "edit", label: t("Appointment:EventCard:Update"), icon: EditIcon },
    selected
      ? { key: "deselect", label: t("Appointment:EventCard:Deselect"), icon: CheckedBoxIcon }
      : { key: "select-delete", label: t("Appointment:EventCard:SelectForMultiDelete"), icon: EmptyBoxIcon, disabled: undeletable },
    { key: "delete", label: t("Common:Delete"), danger: true, icon: TrashIcon, disabled: undeletable },
  ];
}
