import { useState } from "react";
import { Button, Popover } from "antd";
import { ClockCircleOutlined } from "@ant-design/icons";
import { ClockPicker } from "@/components/StringPickers";
import { t } from "@/lib/i18n";
import {
  DEFAULT_CALENDAR_WINDOW,
  isValidWindow,
  useCalendarWindowStore,
  WINDOW_STEP_MINUTES,
  type CalendarWindow,
} from "../store/calendarWindowStore";

function formatMinute(minute: number): string {
  const h = Math.floor(minute / 60).toString().padStart(2, "0");
  const m = (minute % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

/** "HH:mm" back to minutes of the day; null when the picker was cleared. */
function parseClock(clock: string): number | null {
  const [h, m] = clock.split(":").map(Number);
  return Number.isInteger(h) && Number.isInteger(m) ? h * 60 + m : null;
}

interface FormProps {
  initial: CalendarWindow;
  onApply: (range: CalendarWindow) => void;
}

interface ClockFieldProps {
  label: string;
  minute: number;
  invalid?: boolean;
  onChange: (minute: number) => void;
}

/** The same HH:mm picker as Giờ hẹn, on 15-minute steps over the whole day. */
function ClockField({ label, minute, invalid, onChange }: ClockFieldProps) {
  const handleChange = (clock: string) => {
    const picked = parseClock(clock);
    if (picked !== null) onChange(picked);
  };
  return (
    <label className="cal-hours-field">
      <span>{label}</span>
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
    </label>
  );
}

/** The two pickers; nothing reaches the calendars until Áp dụng. */
function ShownHoursForm({ initial, onApply }: FormProps) {
  const [draft, setDraft] = useState(initial);
  const valid = isValidWindow(draft);

  return (
    <div className="cal-hours-form">
      <ClockField
        label={t("Appointment:ShownHours:From")}
        minute={draft.fromMinute}
        onChange={(fromMinute) => setDraft((d) => ({ ...d, fromMinute }))}
      />
      <ClockField
        label={t("Appointment:ShownHours:To")}
        minute={draft.toMinute}
        invalid={!valid}
        onChange={(toMinute) => setDraft((d) => ({ ...d, toMinute }))}
      />
      <div className={valid ? "cal-hours-hint" : "cal-hours-hint cal-hours-hint--error"} role={valid ? undefined : "alert"}>
        {valid ? t("Appointment:ShownHours:Hint") : t("Appointment:ShownHours:Invalid")}
      </div>
      <div className="cal-hours-actions">
        <Button size="small" onClick={() => setDraft(DEFAULT_CALENDAR_WINDOW)}>
          {t("Appointment:ShownHours:Default")}
        </Button>
        <Button size="small" type="primary" disabled={!valid} onClick={() => onApply(draft)}>
          {t("Appointment:ShownHours:Apply")}
        </Button>
      </div>
    </div>
  );
}

interface Props {
  /** Extra class for where it sits (desktop/mobile toolbar, mini calendar). */
  className?: string;
  disabled?: boolean;
  size?: "small" | "middle";
}

/**
 * R-977: the hours every calendar shows, chosen by the viewer and shared by
 * the day view, the week view and "Lịch đã hẹn".
 */
export function ShownHoursButton({ className, disabled, size }: Props) {
  const range = useCalendarWindowStore((s) => s.range);
  const setWindow = useCalendarWindowStore((s) => s.setWindow);
  const [open, setOpen] = useState(false);
  const label = t("Appointment:ShownHours:Button");

  const handleApply = (next: CalendarWindow) => {
    setWindow(next);
    setOpen(false);
  };

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      trigger="click"
      placement="bottomRight"
      classNames={{ root: "cal-hours-popover" }}
      title={label}
      destroyOnHidden
      content={<ShownHoursForm initial={range} onApply={handleApply} />}
    >
      <Button
        className={["cal-btn-hours", className].filter(Boolean).join(" ")}
        size={size}
        icon={<ClockCircleOutlined />}
        disabled={disabled}
        title={`${label}: ${formatMinute(range.fromMinute)} – ${formatMinute(range.toMinute)}`}
        aria-label={label}
      />
    </Popover>
  );
}
