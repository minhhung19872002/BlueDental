import { Input } from "antd";
import { Controller, type Control, type FieldErrors } from "react-hook-form";
import { t } from "@/lib/i18n";
import type { AppointmentEditorValues } from "../types/appointmentEditor";
import type { StoredStatus } from "./appointmentStatusOptions";
import { AppointmentStatusField } from "./AppointmentStatusField";

interface Props {
  control: Control<AppointmentEditorValues>;
  errors: FieldErrors<AppointmentEditorValues>;
  /** The stored status while editing; absent for a new booking. */
  stored?: StoredStatus;
}

/**
 * The third column: Trạng thái when editing, then Nội dung đặt lịch. Ghi chú
 * is gone — the front desk keeps one text, the content (owner, R-1055).
 */
export function AppointmentFormRight({ control, errors, stored }: Props) {
  return (
    <div>
      {stored && <AppointmentStatusField control={control} errors={errors} stored={stored} />}

      {/* Content */}
      <div className="appt-field">
        <label className="appt-field-label">{t("Appointment:Form:BookingContent")}</label>
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
    </div>
  );
}
