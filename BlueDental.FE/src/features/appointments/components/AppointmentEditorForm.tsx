import type { Control, FieldErrors, UseFormSetValue } from "react-hook-form";
import { AppointmentFormLeft } from "./AppointmentFormLeft";
import { AppointmentFormCenter } from "./AppointmentFormCenter";
import { AppointmentFormRight } from "./AppointmentFormRight";
import { AppointmentMiniCalendar } from "./AppointmentMiniCalendar";

export interface AppointmentEditorValues {
  patientId: string;
  branchId: string;
  doctorId: string;
  date: string;
  startTime: string;
  durationMinutes: number;
  content: string;
  color: string;
  notes: string;
}

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
}: Props) {
  return (
    <div className="appt-editor-body">
      <div className="appt-editor-cols">
        <AppointmentFormLeft
          control={control}
          errors={errors}
          patientOptions={patientOptions}
          branchOptions={branchOptions}
        />
        <AppointmentFormCenter
          control={control}
          errors={errors}
          doctorOptions={doctorOptions}
        />
        <AppointmentFormRight control={control} setValue={setValue} notesValue={watchedNotes} isEdit={isEdit} />
      </div>
      <AppointmentMiniCalendar date={watchedDate} doctorId={watchedDoctorId} />
    </div>
  );
}
