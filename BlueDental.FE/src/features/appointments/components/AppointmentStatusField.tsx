import { Input, Select } from "antd";
import { Controller, useWatch, type Control, type FieldErrors } from "react-hook-form";
import { t } from "@/lib/i18n";
import type { AppointmentStatus } from "../types/appointment";
import type { AppointmentEditorValues } from "../types/appointmentEditor";
import { STATUS_GROUP, statusSelectOptions } from "./appointmentStatusOptions";

interface Props {
  control: Control<AppointmentEditorValues>;
  errors: FieldErrors<AppointmentEditorValues>;
  /** What the appointment is now; the select opens on it. */
  currentStatus: AppointmentStatus;
}

/**
 * Trạng thái — the edit dialog's own way of marking an appointment late or
 * cancelled, or of putting a late or cancelled one back on the book. Đã hẹn,
 * Đã huỷ and Trễ hẹn are always offered; Đã đến only shows as the current
 * value of a visit that already arrived.
 *
 * Picking Đã huỷ asks for Lý do hủy (bug list #16); the CSKH Lịch hẹn hủy tab
 * lists it. A booking already cancelled shows its reason read-only.
 */
export function AppointmentStatusField({ control, errors, currentStatus }: Props) {
  const options = statusSelectOptions(currentStatus).map((option) => ({
    value: option.value,
    label: t(option.label),
  }));
  const status = useWatch({ control, name: "status" });
  const alreadyCancelled = STATUS_GROUP[currentStatus] === "cancelled";

  return (
    <>
      <div className="appt-field">
        <label className="appt-field-label" htmlFor="appt-status">
          {t("Common:Status")}
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
      {status === "cancelled" && (
        <div className="appt-field">
          <label className="appt-field-label" htmlFor="appt-cancel-note">
            {t("Appointment:CancelReason")}
            {!alreadyCancelled && <span className="appt-field-required">*</span>}
          </label>
          <Controller
            name="cancelNote"
            control={control}
            render={({ field }) => (
              <Input.TextArea
                {...field}
                id="appt-cancel-note"
                className="appt-cancel-note"
                rows={2}
                maxLength={500}
                disabled={alreadyCancelled}
                placeholder={t("Common:EnterCancelReason")}
                status={errors.cancelNote ? "error" : ""}
              />
            )}
          />
          {errors.cancelNote && <span className="appt-field-error">{errors.cancelNote.message}</span>}
        </div>
      )}
    </>
  );
}
