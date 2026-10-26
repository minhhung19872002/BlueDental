import { Controller, type Control, type FieldErrors, type UseFormSetValue } from "react-hook-form";
import { NotesPanel } from "@/components/NotesPanel";
import type { AppointmentEditorValues } from "../types/appointmentEditor";
import type { StoredStatus } from "./appointmentStatusOptions";
import { AppointmentStatusField } from "./AppointmentStatusField";

interface Props {
  control: Control<AppointmentEditorValues>;
  setValue: UseFormSetValue<AppointmentEditorValues>;
  notesValue: string;
  isEdit?: boolean;
  errors: FieldErrors<AppointmentEditorValues>;
  /** The stored status while editing; absent for a new booking. */
  stored?: StoredStatus;
}

/** The third column: Trạng thái when editing, then the Ghi chú card. */
export function AppointmentFormRight({ control, setValue, notesValue, isEdit, errors, stored }: Props) {
  return (
    <div>
      {stored && <AppointmentStatusField control={control} errors={errors} stored={stored} />}
      <NotesPanel
        value={notesValue}
        onChange={(notes) => setValue("notes", notes)}
        autoEditExisting={isEdit}
      />
      {/* Hidden controller to keep RHF in sync */}
      <Controller name="notes" control={control} render={() => <></>} />
    </div>
  );
}
