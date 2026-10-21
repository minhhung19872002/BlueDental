import { Button } from "antd";
import { CloseOutlined } from "@ant-design/icons";
import { ClockPicker } from "@/components/StringPickers";
import { t } from "@/lib/i18n";
import { WINDOW_STEP_MINUTES, type TimeRange } from "../store/calendarWindowStore";

export function formatMinute(minute: number): string {
  const h = Math.floor(minute / 60).toString().padStart(2, "0");
  const m = (minute % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

/** "HH:mm" back to minutes of the day; null when the picker was cleared. */
function parseClock(clock: string): number | null {
  const [h, m] = clock.split(":").map(Number);
  return Number.isInteger(h) && Number.isInteger(m) ? h * 60 + m : null;
}

interface ClockInputProps {
  label: string;
  minute: number;
  invalid?: boolean;
  onChange: (minute: number) => void;
}

/** The same HH:mm picker as Giờ hẹn, on 15-minute steps over the whole day. */
function ClockInput({ label, minute, invalid, onChange }: ClockInputProps) {
  const handleChange = (clock: string) => {
    const picked = parseClock(clock);
    if (picked !== null) onChange(picked);
  };
  return (
    <ClockPicker
      value={formatMinute(minute)}
      onChange={handleChange}
      format="HH:mm"
      minuteStep={WINDOW_STEP_MINUTES}
      allowClear={false}
      showNow={false}
      placeholder="HH:mm"
      aria-label={label}
      status={invalid ? "error" : undefined}
    />
  );
}

/** Từ giờ / Đến giờ of the window, label beside the picker. */
export function ClockField(props: ClockInputProps) {
  return (
    <label className="cal-hours-field">
      <span>{props.label}</span>
      <ClockInput {...props} />
    </label>
  );
}

interface BreakRowProps {
  /** 1-based, for the pickers' accessible names. */
  position: number;
  range: TimeRange;
  invalid: boolean;
  onChange: (range: TimeRange) => void;
  onRemove: () => void;
}

/** One break: when it starts, when work resumes, and a button to drop it. */
export function BreakRow({ position, range, invalid, onChange, onRemove }: BreakRowProps) {
  return (
    <div className="cal-hours-break">
      <ClockInput
        label={t("Appointment:ShownHours:BreakFrom", position)}
        minute={range.fromMinute}
        invalid={invalid}
        onChange={(fromMinute) => onChange({ ...range, fromMinute })}
      />
      <span className="cal-hours-break-dash">–</span>
      <ClockInput
        label={t("Appointment:ShownHours:BreakTo", position)}
        minute={range.toMinute}
        invalid={invalid}
        onChange={(toMinute) => onChange({ ...range, toMinute })}
      />
      <Button
        size="small"
        type="text"
        icon={<CloseOutlined />}
        aria-label={t("Appointment:ShownHours:RemoveBreak", position)}
        onClick={onRemove}
      />
    </div>
  );
}
