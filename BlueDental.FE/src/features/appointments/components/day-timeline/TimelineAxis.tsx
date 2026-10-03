import React from "react";
import { t } from "@/lib/i18n";
import { formatMinute, minuteToX, type TimeScale } from "./timelineLayout";

interface Props {
  scale: TimeScale;
  slots: number[];
  /** Minute of day the "now" badge sits at; null when the day shown is not today. */
  nowMinute: number | null;
}

/** The sticky header: "Bác sĩ" over the names, half-hour ticks over the track. */
export function TimelineAxis({ scale, slots, nowMinute }: Props) {
  return (
    <div className="dtl-head">
      <div className="dtl-corner">{t("Appointment:Timeline:Doctor")}</div>
      <div className="dtl-axis">
        {slots
          .filter((minute) => minute % 30 === 0)
          .map((minute) => (
            <span
              key={minute}
              className="dtl-tick"
              style={{ "--dtl-x": `${minuteToX(scale, minute)}px` } as React.CSSProperties}
            >
              {formatMinute(minute)}
            </span>
          ))}
        {nowMinute !== null && (
          <span
            className="dtl-now-badge"
            style={{ "--dtl-x": `${minuteToX(scale, nowMinute)}px` } as React.CSSProperties}
          >
            {formatMinute(nowMinute)}
          </span>
        )}
      </div>
    </div>
  );
}
