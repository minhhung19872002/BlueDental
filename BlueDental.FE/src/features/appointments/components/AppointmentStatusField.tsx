import { Select } from "antd";
import { Controller, type Control } from "react-hook-form";
import { t } from "@/lib/i18n";
import type { AppointmentStatus } from "../types/appointment";
import type { AppointmentEditorValues } from "../types/appointmentEditor";
import { statusSelectOptions } from "./appointmentStatusOptions";

interface Props {
  control: Control<AppointmentEditorValues>;
  /** What the appointment is now; the select opens on it. */
  currentStatus: AppointmentStatus;
}

/**
 * Trạng thái — the edit dialog's own way of marking an appointment late or
 * cancelled, or of putting a late or cancelled one back on the book. Đã hẹn,
 * Đã huỷ and Trễ hẹn are always offered; Đã đến only shows as the current
 * value of a visit that already arrived.
 */
export function AppointmentStatusField({ control, currentStatus }: Props) {
  const options = statusSelectOptions(currentStatus).map((option) => ({
    value: option.value,
    label: t(option.label),
  }));

  return (
    <div className="appt-field">
      <label className="appt-field-label" htmlFor="appt-status">
        {t("Trạng thái")}
      </label>
      <Controller
        name="status"
        control={control}
        render={({ field }) => (
          <Select
            id="appt-status"
            className="appt-status-select"
            size="large"
            value={field.value}
            options={options}
            onChange={field.onChange}
          />
        )}
      />
    </div>
  );
}
