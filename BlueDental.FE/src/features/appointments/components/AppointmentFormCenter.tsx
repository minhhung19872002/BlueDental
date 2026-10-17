import { Input } from "antd";
import { Controller, type Control, type FieldErrors, type UseFormSetValue } from "react-hook-form";
import { SearchSelect } from "@/components/SearchSelect";
import { t } from "@/lib/i18n";
import { AppointmentColorPicker } from "./AppointmentColorPicker";
import type { AppointmentEditorValues } from "../types/appointmentEditor";

interface Props {
  control: Control<AppointmentEditorValues>;
  errors: FieldErrors<AppointmentEditorValues>;
  doctorOptions: { value: string; label: string }[];
  setValue: UseFormSetValue<AppointmentEditorValues>;
}

export function AppointmentFormCenter({ control, errors, doctorOptions, setValue }: Props) {
  // ✕ on Chọn bác sĩ empties it and says at once that it is required (Lưu stays off).
  const handleDoctorChange = (value: string | undefined) =>
    setValue("doctorId", value ?? "", { shouldValidate: true, shouldDirty: true });

  return (
    <div>
      {/* Doctor */}
      <div className="appt-field">
        <label className="appt-field-label">
          {t("Appointment:Form:SelectDoctor")}<span className="appt-field-required">*</span>
        </label>
        <Controller
          name="doctorId"
          control={control}
          render={({ field }) => (
            <SearchSelect
              value={field.value || undefined}
              placeholder={t("Appointment:Form:SelectDoctor")}
              options={doctorOptions}
              allowClear
              onChange={handleDoctorChange}
              status={errors.doctorId ? "error" : ""}
            />
          )}
        />
        {errors.doctorId && <span className="appt-field-error">{errors.doctorId.message}</span>}
      </div>

      {/* Content */}
      <div className="appt-field">
        <Controller
          name="content"
          control={control}
          render={({ field }) => (
            <Input.TextArea
              {...field}
              rows={4}
              placeholder={t("Appointment:Form:BookingContent")}
              style={{ resize: "none" }}
            />
          )}
        />
      </div>

      {/* Color */}
      <Controller
        name="color"
        control={control}
        render={({ field }) => (
          <AppointmentColorPicker value={field.value} onChange={field.onChange} />
        )}
      />
    </div>
  );
}
