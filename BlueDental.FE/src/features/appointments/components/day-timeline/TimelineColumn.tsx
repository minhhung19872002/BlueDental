import React, { useMemo } from "react";
import { t } from "@/lib/i18n";
import type { AppointmentDto } from "../../types/appointment";
import { blockStateOf } from "./blockState";
import { TimelineBlock } from "./TimelineBlock";
import { placeBlocks, type TimeScale } from "./timelineLayout";
import { NO_ID, patientCount } from "./timelineRows";
import { TimelineSlots } from "./TimelineSlots";

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

/**
 * One doctor: name and patient count on top, the day's bookings laid down the
 * axis. The `NO_ID` column holds "Lịch tạm" nobody is on yet: its slots book no
 * one (there is no doctor to book), a block opens its booking to assign one.
 */
export const TimelineColumn = React.memo(function TimelineColumn({
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
  const column = useMemo(() => placeBlocks(appointments, scale), [appointments, scale]);
  const unassigned = doctorId === NO_ID;
  const name = unassigned ? t("Appointment:Timeline:Unassigned") : doctorName;
  const patients = patientCount(appointments);
  const countLabel = t("Appointment:Timeline:PatientCount").replace("{0}", String(patients));
  const title = unassigned ? `${t("Appointment:Timeline:UnassignedHint")} · ${countLabel}` : `${name} · ${countLabel}`;

  return (
    <div
      className={unassigned ? "dtl-col dtl-col--unassigned" : "dtl-col"}
      style={{ "--dtl-lanes": column.laneCount } as React.CSSProperties}
    >
      <div className="dtl-doc" title={title}>
        <span className="dtl-name">{name}</span>
        <span className="dtl-count">{patients}</span>
      </div>
      <div className="dtl-track">
        <TimelineSlots doctorId={doctorId} slots={slots} onCellClick={unassigned ? undefined : onCellClick} />
        {column.blocks.map((placed) => (
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
