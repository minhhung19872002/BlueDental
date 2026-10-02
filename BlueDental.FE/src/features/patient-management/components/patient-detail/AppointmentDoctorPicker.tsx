import { useMemo, useState } from "react";
import dayjs from "dayjs";
import { toast } from "sonner";
import { FloatingLabel } from "@/components/FloatingLabel";
import { SearchSelect } from "@/components/SearchSelect";
import { useDentistStaffOptions } from "@/hooks/useStaffOptions";
import { extractApiError } from "@/lib/apiError";
import { notifyError } from "@/lib/notify";
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
  // Only doctors not registered OFF on the appointment's day; the one it
  // already has stays listed by name.
  const dentists = useDentistStaffOptions(dayjs(appointment.startTime).format("YYYY-MM-DD"));
  const options = useMemo(() => {
    const listed = dentists.data ?? [];
    if (!appointment.doctorId || listed.some((o) => o.value === appointment.doctorId)) return listed;
    return [...listed, { value: appointment.doctorId, label: appointment.doctorName }];
  }, [dentists.data, appointment.doctorId, appointment.doctorName]);
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
      toast.success(t("Patient:DoctorChangedSuccess"));
      onChanged();
    } catch (error) {
      setPending(undefined);
      notifyError(extractApiError(error));
    }
  };

  return (
    <FloatingLabel label={t("Patient:DoctorLabel")} floated={Boolean(value)} className="pd-appt-doctor-picker">
      <SearchSelect
        value={value}
        options={options}
        emptyText={t("Patient:DoctorNotFound")}
        onChange={(doctorId) => void change(doctorId)}
      />
    </FloatingLabel>
  );
}
