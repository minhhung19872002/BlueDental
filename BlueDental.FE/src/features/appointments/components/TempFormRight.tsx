import { Input } from "antd";
import { Controller, type Control } from "react-hook-form";
import dayjs from "dayjs";
import { SearchSelect } from "@/components/SearchSelect";
import { t } from "@/lib/i18n";
import type { TempAppointmentFormValues } from "./TempAppointmentForm";

interface Props {
  control: Control<TempAppointmentFormValues>;
  branchOptions: { value: string; label: string }[];
  watchedDate: string;
}

export function TempFormRight({ control, branchOptions, watchedDate }: Props) {
  return (
    <div>
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

      {/* Date display (read-only echo) */}
      <div className="appt-field">
        <label className="appt-field-label">{t("Ngày hẹn")}</label>
        <div className="appt-date-display">
          {watchedDate ? dayjs(watchedDate).format("DD/MM/YYYY") : "—"}
        </div>
      </div>

      {/* Notes — simple textarea */}
      <div className="appt-field">
        <label className="appt-field-label">{t("Ghi chú")}</label>
        <Controller
          name="notes"
          control={control}
          render={({ field }) => (
            <Input.TextArea
              {...field}
              rows={4}
              placeholder={t("Ghi chú")}
              style={{ resize: "none" }}
            />
          )}
        />
      </div>
    </div>
  );
}
