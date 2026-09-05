import type { Control, FieldErrors, UseFormSetValue } from "react-hook-form";
import type { AppointmentStatus } from "../types/appointment";
import type { AppointmentEditorValues } from "../types/appointmentEditor";
import { AppointmentFormLeft } from "./AppointmentFormLeft";
import { AppointmentFormCenter } from "./AppointmentFormCenter";
import { AppointmentFormRight } from "./AppointmentFormRight";
import { AppointmentMiniCalendar } from "./AppointmentMiniCalendar";

interface Props {
  control: Control<AppointmentEditorValues>;
  errors: FieldErrors<AppointmentEditorValues>;
  patientOptions: { value: string; label: string }[];
  branchOptions: { value: string; label: string }[];
  doctorOptions: { value: string; label: string }[];
  setValue: UseFormSetValue<AppointmentEditorValues>;
  watchedDoctorId: string;
  watchedDate: string;
  watchedNotes: string;
  isEdit?: boolean;
  /** The stored status of the appointment being edited; drives Trạng thái. */
  currentStatus?: AppointmentStatus;
  /** Opened from a patient's record: the patient is fixed. */
  lockPatient?: boolean;
}

export function AppointmentEditorForm({
  control,
  errors,
  patientOptions,
  branchOptions,
  doctorOptions,
  setValue,
  watchedDoctorId,
  watchedDate,
  watchedNotes,
  isEdit,
  currentStatus,
  lockPatient,
}: Props) {
  return (
    <div className="appt-editor-body">
      <div className="appt-editor-cols">
        <AppointmentFormLeft
          control={control}
          errors={errors}
          patientOptions={patientOptions}
          branchOptions={branchOptions}
          lockPatient={lockPatient}
        />
        <AppointmentFormCenter
          control={control}
          errors={errors}
          doctorOptions={doctorOptions}
        />
        <AppointmentFormRight
          control={control}
          setValue={setValue}
          notesValue={watchedNotes}
          isEdit={isEdit}
          currentStatus={currentStatus}
        />
      </div>
      <AppointmentMiniCalendar date={watchedDate} doctorId={watchedDoctorId} />
    </div>
  );
}
