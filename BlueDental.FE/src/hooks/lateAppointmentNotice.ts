import dayjs from "dayjs";
import { toast } from "sonner";
import { api } from "@/lib/axios";
import { t } from "@/lib/i18n";

/** Bookings named one by one in the toast; the rest are counted. */
const NAMED_LIMIT = 5;
/** Long enough to be noticed by someone busy at the chair. */
const TOAST_DURATION_MS = 10_000;

/** The fields the toast needs out of `BlueDental.Appointments.AppointmentDto`. */
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
 * know, not only see a row move). The push carries ids only, so each booking is
 * read back through the API; one the viewer may not open is left out, and a
 * viewer who may open none of them gets no toast.
 */
export async function announceLateAppointments(appointmentIds: readonly string[]): Promise<void> {
  const reads = await Promise.allSettled(
    appointmentIds
      .slice(0, NAMED_LIMIT)
      .map((id) => api.get<LateAppointmentRow>(`/v1/app/appointments/${id}`).then((r) => r.data)),
  );
  const rows = reads.flatMap((read) => (read.status === "fulfilled" ? [read.value] : []));
  if (rows.length === 0) return;

  if (appointmentIds.length === 1) {
    toast.warning(t("Appointment:LateToast:One", rows[0].patientName), {
      description: slotLine(rows[0]),
      duration: TOAST_DURATION_MS,
    });
    return;
  }

  const lines = rows.map((row) => `${dayjs(row.slotStart).format("HH:mm")} · ${row.patientName}`);
  const unnamed = appointmentIds.length - rows.length;
  if (unnamed > 0) lines.push(t("Appointment:LateToast:More", unnamed));
  toast.warning(t("Appointment:LateToast:Many", appointmentIds.length), {
    description: lines.join("\n"),
    duration: TOAST_DURATION_MS,
  });
}
