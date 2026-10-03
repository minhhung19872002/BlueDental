import React, { useMemo } from "react";
import type { AppointmentDto } from "../../types/appointment";
import { blockStateOf } from "./blockState";
import { TimelineBlock } from "./TimelineBlock";
import { formatMinute, placeBlocks, type TimeScale } from "./timelineLayout";

interface Props {
  doctorId: string;
  doctorName: string;
  appointments: AppointmentDto[];
  scale: TimeScale;
  slots: number[];
  now: number;
  selectedIds?: Set<string>;
  onCellClick: (doctorId: string, time: string) => void;
  onCardAction?: (action: string, id: string) => void;
}

/** One doctor: the name on the left, the day's bookings laid along the axis. */
export const TimelineRow = React.memo(function TimelineRow({
  doctorId,
  doctorName,
  appointments,
  scale,
  slots,
  now,
  selectedIds,
  onCellClick,
  onCardAction,
}: Props) {
  const row = useMemo(() => placeBlocks(appointments, scale), [appointments, scale]);

  return (
    <div className="dtl-row" style={{ "--dtl-lanes": row.laneCount } as React.CSSProperties}>
      <div className="dtl-name" title={doctorName}>{doctorName}</div>
      <div className="dtl-track">
        {slots.map((minute) => (
          <div
            key={minute}
            className={minute % 60 === 0 ? "dtl-cell dtl-cell--hour" : "dtl-cell"}
            data-time={formatMinute(minute)}
            onClick={() => onCellClick(doctorId, formatMinute(minute))}
          />
        ))}
        {row.blocks.map((placed) => (
          <TimelineBlock
            key={placed.appointment.id}
            placed={placed}
            state={blockStateOf(placed.appointment, now)}
            selected={selectedIds?.has(placed.appointment.id)}
            onAction={onCardAction}
          />
        ))}
      </div>
    </div>
  );
});
