import { useState } from "react";
import { Button, Popover } from "antd";
import { ClockCircleOutlined } from "@ant-design/icons";
import { t } from "@/lib/i18n";
import { useCalendarWindowStore, type CalendarWindow, type TimeRange } from "../store/calendarWindowStore";
import { formatMinute } from "./ShownHoursFields";
import { ShownHoursForm } from "./ShownHoursForm";

const spanText = (range: TimeRange) => `${formatMinute(range.fromMinute)} – ${formatMinute(range.toMinute)}`;

/** "Khung giờ hiển thị: 08:00 – 18:45 · Giờ giải lao: 12:00 – 13:00" for the button's tooltip. */
function windowTitle(label: string, range: CalendarWindow): string {
  const shown = `${label}: ${spanText(range)}`;
  if (range.breaks.length === 0) return shown;
  return `${shown} · ${t("Appointment:ShownHours:Breaks")}: ${range.breaks.map(spanText).join(", ")}`;
}

interface Props {
  /** Extra class for where it sits (desktop/mobile toolbar, mini calendar). */
  className?: string;
  disabled?: boolean;
  size?: "small" | "middle";
}

/**
 * R-977: the hours every calendar shows, chosen by the viewer and shared by
 * the day view, the week view and "Lịch đã hẹn"; R-1005: with breaks folded out.
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
        title={windowTitle(label, range)}
        aria-label={label}
      />
    </Popover>
  );
}
