import dayjs, { type Dayjs } from "dayjs";
import { TimePicker } from "antd";
import { DeleteOutlined, ExclamationCircleOutlined } from "@ant-design/icons";

import type { LeaveShift } from "../../api/timekeepingApi";
import {
  LEAVE_SHIFT_OPTIONS,
  formatDuration,
  leaveDayError,
  leaveMinutes,
  shiftLabel,
  shiftLongLabel,
  shiftRange,
  toMinutes,
  type LeaveDayDraft,
  type TimeRange,
} from "../../utils/leaveShifts";
import { t } from "@/lib/i18n";

const TIME_FORMAT = "hh:mm A";
const HOURS = Array.from({ length: 24 }, (_, h) => h);
const MINUTES = Array.from({ length: 60 }, (_, m) => m);

const ERROR_KEY = {
  ShiftRequired: "Timekeeping:Leave:ShiftRequired",
  EndAfterStart: "Timekeeping:Leave:EndAfterStart",
} as const;

const toDayjs = (time: string): Dayjs => dayjs().startOf("day").add(toMinutes(time), "minute");

/** Keeps the picker inside the chosen shift: "Có thể chỉnh giờ trong phạm vi ca". */
function boundTo(range: TimeRange) {
  const min = toMinutes(range.start);
  const max = toMinutes(range.end);
  return () => ({
    disabledHours: () => HOURS.filter((h) => h * 60 + 59 < min || h * 60 > max),
    disabledMinutes: (hour: number) =>
      MINUTES.filter((m) => hour * 60 + m < min || hour * 60 + m > max),
  });
}

function dayTitle(date: string): string {
  const d = dayjs(date);
  return `${t(`Timekeeping:Leave:Weekday${d.day()}`)}, ${d.format("DD/MM/YYYY")}`;
}

interface Props {
  day: LeaveDayDraft;
  onShiftChange: (date: string, shift: LeaveShift) => void;
  onTimeChange: (date: string, field: "start" | "end", value: string) => void;
  onRemove: (date: string) => void;
}

export function LeaveDayCard({ day, onShiftChange, onTimeChange, onRemove }: Props) {
  const error = leaveDayError(day);
  const bounds = day.shift === null ? null : shiftRange(day.windows, day.shift);
  const subtitle =
    day.shift === null
      ? t("Timekeeping:Leave:NoShift")
      : t(
          "Timekeeping:Leave:ShiftSummary",
          shiftLongLabel(day.shift),
          day.start,
          day.end,
          formatDuration(leaveMinutes(day)),
        );

  return (
    <section
      className={["lv-day", day.shift === null && "lv-day--missing"].filter(Boolean).join(" ")}
      aria-label={dayTitle(day.date)}
    >
      <header className="lv-day-head">
        <div className="bd-min0">
          <h4 className="lv-day-title">{dayTitle(day.date)}</h4>
          <p className="lv-day-sub">{subtitle}</p>
        </div>
        <button
          type="button"
          className="lv-day-remove"
          aria-label={`${t("Timekeeping:Leave:RemoveDay")} ${dayTitle(day.date)}`}
          onClick={() => onRemove(day.date)}
        >
          <DeleteOutlined />
        </button>
      </header>

      <div className="lv-shift-options">
        {LEAVE_SHIFT_OPTIONS.map((shift) => {
          const range = shiftRange(day.windows, shift);
          return (
            <button
              key={shift}
              type="button"
              className={["lv-shift", day.shift === shift && "lv-shift--active"].filter(Boolean).join(" ")}
              aria-pressed={day.shift === shift}
              onClick={() => onShiftChange(day.date, shift)}
            >
              <span className="lv-shift-name">{shiftLabel(shift)}</span>
              <span className="lv-shift-time">{range.start} - {range.end}</span>
            </button>
          );
        })}
      </div>

      {bounds && (
        <div className="lv-day-times">
          <label className="lv-time">
            <span>{t("Timekeeping:Leave:From")}</span>
            <TimePicker
              value={toDayjs(day.start)}
              format={TIME_FORMAT}
              allowClear={false}
              needConfirm={false}
              showNow={false}
              disabledTime={boundTo(bounds)}
              onChange={(v) => v && onTimeChange(day.date, "start", v.format("HH:mm"))}
            />
          </label>
          <label className="lv-time">
            <span>{t("Timekeeping:Leave:To")}</span>
            <TimePicker
              value={toDayjs(day.end)}
              format={TIME_FORMAT}
              allowClear={false}
              needConfirm={false}
              showNow={false}
              disabledTime={boundTo(bounds)}
              onChange={(v) => v && onTimeChange(day.date, "end", v.format("HH:mm"))}
            />
          </label>
        </div>
      )}

      {error && (
        <p className="lv-day-error" role="alert">
          <ExclamationCircleOutlined /> {t(ERROR_KEY[error])}
        </p>
      )}
    </section>
  );
}
