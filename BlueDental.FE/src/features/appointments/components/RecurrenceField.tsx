import { useMemo } from "react";
import { Checkbox, Select } from "antd";
import { Repeat } from "lucide-react";
import { t } from "@/lib/i18n";
import { RECURRENCE_PRESETS, type RecurrencePreset, type RecurrenceValues } from "../types/appointmentSeries";
import { presetLabel } from "./recurrenceLabels";
import { RecurrenceCustomPanel } from "./RecurrenceCustomPanel";
import { RecurrenceEndRow } from "./RecurrenceEndRow";

interface Props {
  values: RecurrenceValues;
  /** Ngày hẹn: every option is read off it. */
  bookingDate: string;
  /** Editing a session of a series: ticked, and the rule cannot change. */
  locked: boolean;
  onChange: (change: Partial<RecurrenceValues>) => void;
}

/** "Lặp lại lịch hẹn", under Giờ hẹn / Phút. */
export function RecurrenceField({ values, bookingDate, locked, onChange }: Props) {
  const presetOptions = useMemo(
    () => RECURRENCE_PRESETS.map((preset) => ({ value: preset, label: presetLabel(preset, bookingDate) })),
    [bookingDate],
  );
  const expanded = values.enabled && !locked;

  return (
    <div className="appt-field appt-recur">
      <Checkbox
        checked={locked || values.enabled}
        disabled={locked}
        onChange={(e) => onChange({ enabled: e.target.checked })}
      >
        {t("Appointment:Series:Repeat")}
      </Checkbox>

      {expanded && (
        <div className="appt-recur-body">
          <Select<RecurrencePreset>
            className="appt-recur-preset"
            prefix={<Repeat size={16} className="appt-recur-preset-icon" aria-hidden="true" />}
            value={values.preset}
            options={presetOptions}
            aria-label={t("Appointment:Series:RuleLabel")}
            onChange={(preset) => onChange({ preset })}
          />
          {values.preset === "custom" && (
            <RecurrenceCustomPanel values={values} bookingDate={bookingDate} onChange={onChange} />
          )}
          <RecurrenceEndRow values={values} bookingDate={bookingDate} onChange={onChange} />
        </div>
      )}
    </div>
  );
}
