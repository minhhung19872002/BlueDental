import React from "react";
import { formatMinute } from "./timelineLayout";

interface Props {
  doctorId: string;
  slots: number[];
  /** Undefined when the column has no doctor to book for: its slots open nothing. */
  onCellClick?: (doctorId: string, time: string) => void;
}

/**
 * A column's empty slots. Kept apart from the bookings so the minute tick,
 * which re-renders the column for the blocks' state, leaves this grid alone.
 */
export const TimelineSlots = React.memo(function TimelineSlots({ doctorId, slots, onCellClick }: Props) {
  return (
    <>
      {slots.map((minute) => (
        <div
          key={minute}
          className={minute % 60 === 0 ? "dtl-cell dtl-cell--hour" : "dtl-cell"}
          data-time={formatMinute(minute)}
          onClick={onCellClick && (() => onCellClick(doctorId, formatMinute(minute)))}
        />
      ))}
    </>
  );
});
