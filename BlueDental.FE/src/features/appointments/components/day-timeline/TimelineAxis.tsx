import React, { useMemo } from "react";
import { t } from "@/lib/i18n";
import { formatMinute, minuteToY, type TimeScale } from "./timelineLayout";

interface Props {
  scale: TimeScale;
  slots: number[];
  /** Minute of day the "now" badge sits at; null when the day shown is not today. */
  nowMinute: number | null;
}

/**
 * The sticky left column: "Bác sĩ" in the corner over the doctors' names,
 * a tick per slot running down beside the columns (BA 2026-10-16: on the
 * 15-minute grid every quarter hour is labelled — 10:00, 10:15, 10:30…).
 */
export function TimelineAxis({ scale, slots, nowMinute }: Props) {
  // Only the now badge moves with the clock; the ticks stay put between minutes.
  const ticks = useMemo(
    () =>
      slots.map((minute) => (
          <span
            key={minute}
            className="dtl-tick"
            style={{ "--dtl-y": `${minuteToY(scale, minute)}px` } as React.CSSProperties}
          >
            {formatMinute(minute)}
          </span>
        )),
    [scale, slots],
  );

  return (
    <div className="dtl-timecol">
      <div className="dtl-corner">{t("Appointment:Timeline:Doctor")}</div>
      <div className="dtl-axis">
        {ticks}
        {nowMinute !== null && (
          <span
            className="dtl-now-badge"
            style={{ "--dtl-y": `${minuteToY(scale, nowMinute)}px` } as React.CSSProperties}
          >
            {formatMinute(nowMinute)}
          </span>
        )}
      </div>
    </div>
  );
}
