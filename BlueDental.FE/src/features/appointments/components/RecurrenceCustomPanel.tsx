import { Segmented } from "antd";
import { t } from "@/lib/i18n";
import {
  isoWeekday,
  MAX_RECURRENCE_INTERVAL,
  RECURRENCE_UNITS,
  type RecurrenceUnit,
  type RecurrenceValues,
} from "../types/appointmentSeries";
import { ISO_WEEKDAYS, UNIT_LABEL_KEY, weekdayShort } from "./recurrenceLabels";
import { RecurrenceStepper } from "./RecurrenceStepper";

interface Props {
  values: RecurrenceValues;
  bookingDate: string;
  onChange: (change: Partial<RecurrenceValues>) => void;
}

/**
 * Tuỳ chỉnh: "Mỗi N ngày | tuần | tháng", and for weeks the days it falls on.
 * The booking's own weekday is always one of them, so its chip cannot be
 * switched off.
 */
export function RecurrenceCustomPanel({ values, bookingDate, onChange }: Props) {
  const bookingWeekday = bookingDate ? isoWeekday(bookingDate) : null;
  const unitOptions = RECURRENCE_UNITS.map((unit) => ({ value: unit, label: t(UNIT_LABEL_KEY[unit]) }));
  const everyLabel = t("Appointment:Series:Every");

  const toggleDay = (day: number) => {
    const picked = values.weekDays.includes(day)
      ? values.weekDays.filter((d) => d !== day)
      : [...values.weekDays, day].sort((a, b) => a - b);
    onChange({ weekDays: picked });
  };

  return (
    <div className="appt-recur-custom">
      <div className="appt-recur-line">
        <span className="appt-recur-caption">{everyLabel}</span>
        <RecurrenceStepper
          value={values.interval}
          min={1}
          max={MAX_RECURRENCE_INTERVAL}
          label={everyLabel}
          onChange={(interval) => onChange({ interval })}
        />
        <Segmented<RecurrenceUnit>
          value={values.unit}
          options={unitOptions}
          aria-label={t("Appointment:Series:UnitLabel")}
          onChange={(unit) => onChange({ unit })}
        />
      </div>

      {values.unit === "week" && (
        <div className="appt-recur-line">
          <span className="appt-recur-caption">{t("Appointment:Series:OnDays")}</span>
          <div className="appt-recur-days" role="group" aria-label={t("Appointment:Series:OnDays")}>
            {ISO_WEEKDAYS.map((day) => {
              const fixed = day === bookingWeekday;
              const on = fixed || values.weekDays.includes(day);
              return (
                <button
                  key={day}
                  type="button"
                  className={["appt-recur-day", on && "appt-recur-day--on"].filter(Boolean).join(" ")}
                  aria-pressed={on}
                  disabled={fixed}
                  onClick={() => toggleDay(day)}
                >
                  {weekdayShort(day)}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
