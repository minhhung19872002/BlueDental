import { t } from "@/lib/i18n";
import { WORK_SCHEDULE_SHIFT, type WorkScheduleShift } from "../../api/workScheduleApi";
import type { SchedulePaint } from "../../hooks/useSchedulePaint";
import type { ScheduleDay, ScheduleMemberVm } from "../../types/workSchedule";
import { SHIFT_CODE } from "../../utils/workScheduleShift";
import { dowShort, shiftLabel } from "../../utils/workScheduleText";

interface Props {
  member: ScheduleMemberVm;
  day: ScheduleDay;
  month: number;
  shift: WorkScheduleShift;
  pending: boolean;
  paint: SchedulePaint;
}

export function dayColumnClass(day: ScheduleDay): string {
  return ["ws-dcol", day.isWeekend && "ws-dcol--weekend", day.isToday && "ws-dcol--today"]
    .filter(Boolean)
    .join(" ");
}

/** One person-day square of the team grid: press and drag to paint. */
export function ScheduleCell({ member, day, month, shift, pending, paint }: Props) {
  const readOnly = day.locked || !member.canEdit;
  const cancelling = pending && shift === WORK_SCHEDULE_SHIFT.None;
  const label = t(
    "Timekeeping:Board:CellAria",
    member.fullName,
    `${dowShort(day.dow)} ${day.day}/${month}`,
    shiftLabel(shift) + (pending ? t("Timekeeping:Board:PendingSuffix") : ""),
  );
  const cls = [
    "ws-cell",
    `ws-k-${SHIFT_CODE[shift].css}`,
    pending && "ws-cell--pending",
    day.locked && "ws-cell--past",
    readOnly && "ws-cell--ro",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={dayColumnClass(day)}>
      <button
        type="button"
        className={cls}
        aria-label={label}
        aria-disabled={readOnly}
        title={label}
        onMouseDown={(e) => paint.onMouseDown(member, day, e)}
        onMouseEnter={() => paint.onMouseEnter(member, day)}
        onClick={(e) => paint.onClick(member, day, e)}
      >
        {cancelling ? t("Timekeeping:Board:CancelShort") : SHIFT_CODE[shift].short}
      </button>
    </div>
  );
}
