import { DatePicker, TimePicker, InputNumber } from "antd";
import { Controller, type Control, type FieldErrors } from "react-hook-form";
import dayjs from "dayjs";
import { SearchSelect } from "@/components/SearchSelect";
import { t } from "@/lib/i18n";
import type { AppointmentEditorValues } from "./AppointmentEditorForm";

interface Props {
  control: Control<AppointmentEditorValues>;
  errors: FieldErrors<AppointmentEditorValues>;
  patientOptions: { value: string; label: string }[];
  branchOptions: { value: string; label: string }[];
  /** Opened from a patient's record: the patient is fixed, as the reference fixes it. */
  lockPatient?: boolean;
}

export function AppointmentFormLeft({
  control,
  errors,
  patientOptions,
  branchOptions,
  lockPatient,
}: Props) {
  return (
    <div>
      {/* Patient */}
      <div className="appt-field">
        <label className="appt-field-label">
          {t("Chọn bệnh nhân")}<span className="appt-field-required">*</span>
        </label>
        <Controller
          name="patientId"
          control={control}
          render={({ field }) => (
            <SearchSelect
              value={field.value || undefined}
              placeholder={t("Chọn bệnh nhân")}
              options={patientOptions}
              disabled={lockPatient}
              onChange={(v) => field.onChange(v ?? "")}
              status={errors.patientId ? "error" : ""}
            />
          )}
        />
        {errors.patientId && <span className="appt-field-error">{errors.patientId.message}</span>}
      </div>

      {/* Branch */}
      <div className="appt-field">
        <label className="appt-field-label">{t("Chi nhánh")}</label>
        <Controller
          name="branchId"
          control={control}
          render={({ field }) => (
            <SearchSelect
              value={field.value || undefined}
              placeholder={t("Chọn chi nhánh")}
              options={branchOptions}
              onChange={(v) => field.onChange(v ?? "")}
            />
          )}
        />
      </div>

      {/* Date */}
      <div className="appt-field">
        <label className="appt-field-label">
          {t("Ngày")} <span className="appt-label-accent">{t("hẹn")}</span>
        </label>
        <Controller
          name="date"
          control={control}
          render={({ field }) => (
            <DatePicker
              value={field.value ? dayjs(field.value) : null}
              onChange={(d) => field.onChange(d ? d.format("YYYY-MM-DD") : "")}
              format="DD/MM/YYYY"
              style={{ width: "100%", height: 40 }}
              status={errors.date ? "error" : ""}
            />
          )}
        />
      </div>

      {/* Time + Duration */}
      <div className="appt-time-row">
        <div className="appt-field">
          <label className="appt-field-label">{t("Giờ hẹn")}</label>
          <Controller
            name="startTime"
            control={control}
            render={({ field }) => (
              <TimePicker
                value={field.value ? dayjs(`2000-01-01 ${field.value}`) : null}
                onChange={(v) => field.onChange(v ? v.format("HH:mm") : "")}
                format="HH:mm"
                minuteStep={5}
                style={{ width: "100%", height: 40 }}
                placeholder="HH:mm"
                status={errors.startTime ? "error" : ""}
              />
            )}
          />
        </div>
        <div className="appt-field">
          <label className="appt-field-label">{t("Phút")}</label>
          <Controller
            name="durationMinutes"
            control={control}
            render={({ field }) => (
              <InputNumber
                value={field.value}
                onChange={(v) => field.onChange(v ?? 30)}
                min={15}
                step={15}
                style={{ width: "100%", height: 40 }}
              />
            )}
          />
        </div>
      </div>
    </div>
  );
}
