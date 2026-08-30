import { Input } from "antd";
import { Controller, type Control, type FieldErrors } from "react-hook-form";
import { SearchSelect } from "@/components/SearchSelect";
import { t } from "@/lib/i18n";
import { AppointmentColorPicker } from "./AppointmentColorPicker";
import type { AppointmentEditorValues } from "./AppointmentEditorForm";

interface Props {
  control: Control<AppointmentEditorValues>;
  errors: FieldErrors<AppointmentEditorValues>;
  doctorOptions: { value: string; label: string }[];
}

export function AppointmentFormCenter({ control, errors, doctorOptions }: Props) {
  return (
    <div>
      {/* Doctor */}
      <div className="appt-field">
        <label className="appt-field-label">
          {t("Chọn bác sĩ")}<span className="appt-field-required">*</span>
        </label>
        <Controller
          name="doctorId"
          control={control}
          render={({ field }) => (
            <SearchSelect
              value={field.value || undefined}
              placeholder={t("Chọn bác sĩ")}
              options={doctorOptions}
              onChange={(v) => field.onChange(v ?? "")}
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
              placeholder={t("Nội dung đặt lịch")}
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
