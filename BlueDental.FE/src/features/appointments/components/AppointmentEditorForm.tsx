import type { ReactNode } from "react";
import type { Control, FieldErrors, UseFormSetValue } from "react-hook-form";
import type { CalendarFocus } from "../types/appointmentSeries";
import type { AppointmentStatus } from "../types/appointment";
import type { AppointmentEditorValues } from "../types/appointmentEditor";
import { AppointmentFormLeft } from "./AppointmentFormLeft";
import { AppointmentFormCenter } from "./AppointmentFormCenter";
import { AppointmentFormRight } from "./AppointmentFormRight";
import { AppointmentMiniCalendar } from "./AppointmentMiniCalendar";
import type { MiniCalSlotPick } from "../types/slotPick";

interface Props {
  control: Control<AppointmentEditorValues>;
  errors: FieldErrors<AppointmentEditorValues>;
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
  onOpenNewPatient?: () => void;
  /**
   * "Lặp lại lịch hẹn": the field under Giờ hẹn / Phút, the session list that
   * takes the third column while repeating (Ghi chú then moves under Nội
   * dung), and the slot a clicked session shows in Lịch đã hẹn.
   */
  series?: { field: ReactNode; list: ReactNode | null; focus: CalendarFocus | null };
  /** A slot clicked in Lịch đã hẹn (fills Giờ hẹn and, on a doctor row, Chọn bác sĩ). */
  onSlotPick: (pick: MiniCalSlotPick) => void;
}

export function AppointmentEditorForm({
  control,
  errors,
  branchOptions,
  doctorOptions,
  setValue,
  watchedDoctorId,
  watchedDate,
  watchedNotes,
  isEdit,
  currentStatus,
  lockPatient,
  onOpenNewPatient,
  series,
  onSlotPick,
}: Props) {
  const center = <AppointmentFormCenter control={control} errors={errors} doctorOptions={doctorOptions} setValue={setValue} />;
  const right = (
    <AppointmentFormRight
      control={control}
      errors={errors}
      setValue={setValue}
      notesValue={watchedNotes}
      isEdit={isEdit}
      currentStatus={currentStatus}
    />
  );
  const sessionList = series?.list ?? null;

  return (
    <div className="appt-editor-body">
      <div className="appt-editor-cols">
        <AppointmentFormLeft
          control={control}
          errors={errors}
          branchOptions={branchOptions}
          lockPatient={lockPatient}
          onOpenNewPatient={onOpenNewPatient}
        >
          {series?.field}
        </AppointmentFormLeft>
        {sessionList ? (
          <div>
            {center}
            {right}
          </div>
        ) : (
          <>
            {center}
            {right}
          </>
        )}
        {sessionList}
      </div>
      <AppointmentMiniCalendar
        date={watchedDate}
        doctorId={watchedDoctorId}
        focus={series?.focus ?? null}
        onSlotPick={onSlotPick}
      />
    </div>
  );
}
