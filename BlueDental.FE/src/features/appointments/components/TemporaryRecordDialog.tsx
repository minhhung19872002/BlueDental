import { PatientEditorDialog } from "@/features/patient-management/components/PatientEditorDialog";
import type { PatientDto } from "@/features/patient-management/types/patient";
import { useAttachTemporaryPatient } from "../api/appointmentMutations";
import type { AppointmentDto } from "../types/appointment";

interface Props {
  appointment: Pick<AppointmentDto, "id" | "patientName" | "patientPhone">;
  onClose: () => void;
}

/**
 * "Tạo hồ sơ" opened from a "Lịch tạm" on the calendar, as Tiếp nhận does
 * (BA 2026-11-05): the walk-in's name and phone are filled in, and the saved
 * record takes over the booking so it stops being temporary.
 */
export function TemporaryRecordDialog({ appointment, onClose }: Props) {
  const attachMutation = useAttachTemporaryPatient();

  // The dialog closes itself once the record is saved; a failed link is
  // reported by the shared mutation handler with the server's reason.
  const handleCreated = (patient: PatientDto) => {
    attachMutation.mutate({ id: appointment.id, patientId: patient.id });
  };

  return (
    <PatientEditorDialog
      open
      patient={null}
      prefill={{
        sourceAppointmentId: appointment.id,
        fullName: appointment.patientName,
        phone: appointment.patientPhone || undefined,
      }}
      onClose={onClose}
      onCreated={handleCreated}
    />
  );
}
