import { useState } from "react";
import { toast } from "sonner";
import { FloatingLabel } from "@/components/FloatingLabel";
import { SearchSelect } from "@/components/SearchSelect";
import { useStaffOptions } from "@/hooks/useStaffOptions";
import { extractApiError } from "@/lib/apiError";
import { t } from "@/lib/i18n";
import { useUpdateAppointment } from "@/features/appointments/api/appointmentMutations";
import type { Appointment } from "@/features/appointments/types/appointment";

interface Props {
  appointment: Appointment;
  onChanged: () => void;
}

/**
 * "Bác sĩ" under the Tiếp nhận stepper — the reference reassigns the shown
 * appointment's doctor from the card itself, without opening the editor.
 *
 * The whole appointment is sent back, not just the doctor: the server rebuilds
 * the slot and the details from the request, so a doctor-only body would clear
 * the note, the colour and the time.
 */
export function AppointmentDoctorPicker({ appointment, onChanged }: Props) {
  const staff = useStaffOptions();
  const update = useUpdateAppointment(appointment.id);
  const [pending, setPending] = useState<string>();

  const value = pending ?? appointment.doctorId;

  const change = async (doctorId?: string) => {
    if (!doctorId || doctorId === appointment.doctorId) return;
    setPending(doctorId);

    try {
      await update.mutateAsync({
        doctorId,
        startTime: appointment.startTime,
        endTime: appointment.endTime,
        reason: appointment.reason ?? undefined,
        notes: appointment.notes ?? undefined,
        color: appointment.color ?? undefined,
      });
      toast.success(t("Đã đổi bác sĩ của lịch hẹn"));
      onChanged();
    } catch (error) {
      setPending(undefined);
      toast.error(extractApiError(error));
    }
  };

  return (
    <FloatingLabel label={t("Bác sĩ")} floated={Boolean(value)} className="pd-appt-doctor-picker">
      <SearchSelect
        value={value}
        options={staff.data ?? []}
        emptyText={t("Không tìm thấy bác sĩ")}
        onChange={(doctorId) => void change(doctorId)}
      />
    </FloatingLabel>
  );
}
