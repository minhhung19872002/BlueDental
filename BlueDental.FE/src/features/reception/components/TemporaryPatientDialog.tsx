import { PatientEditorDialog } from "@/features/patient-management/components/PatientEditorDialog";
import type { PatientDto, PatientPrefill } from "@/features/patient-management/types/patient";
import { useAttachReceptionPatient } from "../api/receptionMutations";

export interface TemporaryPatientTarget {
  appointmentId: string;
  prefill: PatientPrefill;
}

interface Props {
  target: TemporaryPatientTarget;
  onClose: () => void;
}

/**
 * "Tạo hồ sơ" opened from a "Lịch tạm" card: the walk-in's name and phone are
 * filled in, and the saved record takes over the appointment so the card stops
 * being temporary — a second click would otherwise make a second record.
 */
export function TemporaryPatientDialog({ target, onClose }: Props) {
  const attachMutation = useAttachReceptionPatient();

  // The dialog closes itself once the record is saved; a failed link is
  // reported by the shared mutation handler with the server's reason.
  const handleCreated = (patient: PatientDto) => {
    attachMutation.mutate({ id: target.appointmentId, patientId: patient.id });
  };

  return (
    <PatientEditorDialog
      open
      patient={null}
      prefill={target.prefill}
      onClose={onClose}
      onCreated={handleCreated}
    />
  );
}
