import { DatePicker, Input, InputNumber, TimePicker } from "antd";
import { Controller, type Control, type FieldErrors } from "react-hook-form";
import dayjs from "dayjs";
import { t } from "@/lib/i18n";
import type { TempAppointmentFormValues } from "./TempAppointmentForm";

interface Props {
  control: Control<TempAppointmentFormValues>;
  errors: FieldErrors<TempAppointmentFormValues>;
}

export function TempFormLeft({ control, errors }: Props) {
  return (
    <div>
      {/* Patient name */}
      <div className="appt-field">
        <label className="appt-field-label">
          {t("Họ tên bệnh nhân")}<span className="appt-field-required">*</span>
        </label>
        <Controller
          name="patientName"
          control={control}
          render={({ field }) => (
            <Input
              {...field}
              placeholder={t("Họ tên bệnh nhân")}
              status={errors.patientName ? "error" : ""}
              style={{ height: 40 }}
            />
          )}
        />
        {errors.patientName && <span className="appt-field-error">{errors.patientName.message}</span>}
      </div>

      {/* Phone */}
      <div className="appt-field">
        <label className="appt-field-label">{t("Số điện thoại")}</label>
        <Controller
          name="patientPhone"
          control={control}
          render={({ field }) => (
            <Input
              {...field}
              placeholder={t("Số điện thoại")}
              style={{ height: 40 }}
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
