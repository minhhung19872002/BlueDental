import type { Control, FieldErrors } from "react-hook-form";
import { TempFormLeft } from "./TempFormLeft";
import { TempFormCenter } from "./TempFormCenter";
import { TempFormRight } from "./TempFormRight";
import { AppointmentMiniCalendar } from "./AppointmentMiniCalendar";
import type { MiniCalSlotPick } from "../types/slotPick";

export interface TempAppointmentFormValues {
  patientName: string;
  patientPhone: string;
  branchId: string;
  doctorId: string;
  date: string;
  startTime: string;
  durationMinutes: number;
  sourceTaxonomyId: string;
  sourceEntryId: string;
  color: string;
  notes: string;
}

interface Props {
  control: Control<TempAppointmentFormValues>;
  errors: FieldErrors<TempAppointmentFormValues>;
  branchOptions: { value: string; label: string }[];
  doctorOptions: { value: string; label: string }[];
  watchedDoctorId: string;
  watchedDate: string;
  watchedSourceTaxonomyId: string;
  /** A slot clicked in Lịch đã hẹn (fills Giờ hẹn and, on a doctor row, Chọn bác sĩ). */
  onSlotPick: (pick: MiniCalSlotPick) => void;
}

export function TempAppointmentForm({
  control,
  errors,
  branchOptions,
  doctorOptions,
  watchedDoctorId,
  watchedDate,
  watchedSourceTaxonomyId,
  onSlotPick,
}: Props) {
  return (
    <div className="appt-editor-body">
      <div className="appt-editor-cols">
        <TempFormLeft control={control} errors={errors} />
        <TempFormCenter
          control={control}
          doctorOptions={doctorOptions}
          watchedSourceTaxonomyId={watchedSourceTaxonomyId}
        />
        <TempFormRight
          control={control}
          branchOptions={branchOptions}
          watchedDate={watchedDate}
        />
      </div>
      <AppointmentMiniCalendar
        date={watchedDate}
        doctorId={watchedDoctorId || undefined}
        onSlotPick={onSlotPick}
      />
    </div>
  );
}
