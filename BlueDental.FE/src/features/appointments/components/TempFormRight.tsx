import { Input } from "antd";
import { Controller, type Control } from "react-hook-form";
import { SearchSelect } from "@/components/SearchSelect";
import { t } from "@/lib/i18n";
import type { TempAppointmentFormValues } from "./TempAppointmentForm";

interface Props {
  control: Control<TempAppointmentFormValues>;
  branchOptions: { value: string; label: string }[];
}

/**
 * Chi nhánh, then Nội dung đặt lịch. Ngày hẹn is set on the left only, and
 * Ghi chú is gone — the front desk keeps one text, the content (owner, R-1055).
 */
export function TempFormRight({ control, branchOptions }: Props) {
  return (
    <div>
      {/* Branch */}
      <div className="appt-field">
        <label className="appt-field-label">{t("Appointment:Form:Branch")}</label>
        <Controller
          name="branchId"
          control={control}
          render={({ field }) => (
            <SearchSelect
              value={field.value || undefined}
              placeholder={t("Appointment:Form:SelectBranch")}
              options={branchOptions}
              onChange={(v) => field.onChange(v ?? "")}
            />
          )}
        />
      </div>

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
