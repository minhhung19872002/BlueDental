import dayjs from "dayjs";
import { useCreateAppointment, useUpdateAppointment } from "../api/appointmentMutations";
import type { AppointmentEditorValues } from "../types/appointmentEditor";

/**
 * The booked window as the API takes it: local wall-clock, no offset. The
 * day runs to midnight, so a 23:45 + 15' booking ends at 00:00 the next day.
 */
export function slotOf(data: Pick<AppointmentEditorValues, "date" | "startTime" | "durationMinutes">) {
  const startTime = `${data.date}T${data.startTime}:00`;
  const endTime = dayjs(startTime)
    .add(data.durationMinutes, "minute")
    .format("YYYY-MM-DDTHH:mm:00");
  return { startTime, endTime };
}

interface SaveAppointment {
  /**
   * Resolves once the server has it; rejects if the server refused.
   * `allowDentistOverlap` once the user confirmed the overlap warning.
   */
  save: (data: AppointmentEditorValues, allowDentistOverlap?: boolean) => Promise<void>;
  saving: boolean;
}

/**
 * Saving the booking dialog. A new appointment is one POST; an edit is one
 * PUT that carries Trạng thái along with the rest, so a late or cancelled
 * mark lands in the same request, and the same history entry, as the edit.
 */
export function useSaveAppointment(appointmentId?: string | null): SaveAppointment {
  const create = useCreateAppointment();
  const update = useUpdateAppointment(appointmentId ?? "");

  const save = async (data: AppointmentEditorValues, allowDentistOverlap = false) => {
    const { startTime, endTime } = slotOf(data);

    if (!appointmentId) {
      await create.mutateAsync({
        patientId: data.patientId,
        doctorId: data.doctorId,
        branchId: data.branchId,
        startTime,
        endTime,
        reason: data.content || undefined,
        color: data.color || undefined,
        notes: data.notes || undefined,
        allowDentistOverlap,
      });
      return;
    }

    await update.mutateAsync({
      doctorId: data.doctorId,
      startTime,
      endTime,
      reason: data.content,
      color: data.color,
      notes: data.notes,
      status: data.status,
      cancelNote: data.status === "cancelled" ? data.cancelNote.trim() : undefined,
      allowDentistOverlap,
    });
  };

  return { save, saving: create.isPending || update.isPending };
}
