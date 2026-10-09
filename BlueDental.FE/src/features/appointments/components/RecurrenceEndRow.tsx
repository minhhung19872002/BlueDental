import { Segmented } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import { DayPicker } from "@/components/StringPickers";
import { t } from "@/lib/i18n";
import { DATE_INPUT_FORMAT } from "@/utils/dateInput";
import { MAX_SERIES_SESSIONS, type RecurrenceEndKind, type RecurrenceValues } from "../types/appointmentSeries";
import { RecurrenceStepper } from "./RecurrenceStepper";

interface Props {
  values: RecurrenceValues;
  bookingDate: string;
  onChange: (change: Partial<RecurrenceValues>) => void;
}

/**
 * Kết thúc: "Sau số lần | Đến ngày" picked like the calendar's Ngày / Tuần /
 * Tháng, and under it only the chosen one's input — the count, or a date no
 * earlier than Ngày hẹn.
 */
export function RecurrenceEndRow({ values, bookingDate, onChange }: Props) {
  const endsLabel = t("Appointment:Series:Ends");
  const timesLabel = t("Appointment:Series:EndAfter");
  const untilLabel = t("Appointment:Series:EndOn");
  const isBeforeBooking = (day: Dayjs) => Boolean(bookingDate) && day.isBefore(dayjs(bookingDate), "day");

  return (
    <div className="appt-recur-end">
      <div className="appt-recur-line">
        <span className="appt-recur-caption">{endsLabel}</span>
        <Segmented<RecurrenceEndKind>
          value={values.endKind}
          options={[
            { value: "count", label: timesLabel },
            { value: "until", label: untilLabel },
          ]}
          aria-label={endsLabel}
          onChange={(endKind) => onChange({ endKind })}
        />
      </div>

      {values.endKind === "count" ? (
        <div className="appt-recur-line">
          <RecurrenceStepper
            value={values.count}
            min={1}
            max={MAX_SERIES_SESSIONS}
            label={timesLabel}
            onChange={(count) => onChange({ count })}
          />
          <span className="appt-recur-caption">{t("Appointment:Series:Times")}</span>
        </div>
      ) : (
        <DayPicker
          className="appt-recur-until"
          value={values.until}
          format={DATE_INPUT_FORMAT}
          disabledDate={isBeforeBooking}
          aria-label={untilLabel}
          onChange={(until) => onChange({ until })}
        />
      )}
    </div>
  );
}
