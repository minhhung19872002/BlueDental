import dayjs from "dayjs";
import { api } from "@/lib/axios";
import { t } from "@/lib/i18n";
import { useLateNoticeStore } from "./lateNoticeStore";

/** Bookings named one by one on the card; the rest are counted. */
const NAMED_LIMIT = 5;

/** The fields the card needs out of `BlueDental.Appointments.AppointmentDto`. */
interface LateAppointmentRow {
  patientName: string;
  dentistName: string | null;
  slotStart: string;
}

function slotLine(row: LateAppointmentRow): string {
  const time = dayjs(row.slotStart).format("HH:mm");
  return row.dentistName
    ? t("Appointment:LateToast:SlotWithDoctor", time, row.dentistName)
    : t("Appointment:LateToast:Slot", time);
}

/**
 * Says which bookings just turned Trễ hẹn (owner 2026-10-07: the clinic has to
 * know, not only see a row move), as a card top right with the chat toasts
 * (R-1217). The push carries ids only, so each booking is read back through
 * the API; one the viewer may not open is left out, and a viewer who may open
 * none of them gets no card.
 */
export async function announceLateAppointments(appointmentIds: readonly string[]): Promise<void> {
  const reads = await Promise.allSettled(
    appointmentIds
      .slice(0, NAMED_LIMIT)
      .map((id) => api.get<LateAppointmentRow>(`/v1/app/appointments/${id}`).then((r) => r.data)),
  );
  const rows = reads.flatMap((read) => (read.status === "fulfilled" ? [read.value] : []));
  if (rows.length === 0) return;
  const { push } = useLateNoticeStore.getState();

  if (appointmentIds.length === 1) {
    push(t("Appointment:LateToast:One", rows[0].patientName), [slotLine(rows[0])]);
    return;
  }

  const lines = rows.map((row) => `${dayjs(row.slotStart).format("HH:mm")} · ${row.patientName}`);
  const unnamed = appointmentIds.length - rows.length;
  if (unnamed > 0) lines.push(t("Appointment:LateToast:More", unnamed));
  push(t("Appointment:LateToast:Many", appointmentIds.length), lines);
}
