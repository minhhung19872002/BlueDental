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

/** One day of the personal month calendar: number, "Chờ lưu" badge, shift name. */
export function PersonDayCard({ member, day, month, shift, pending, paint }: Props) {
  const readOnly = day.locked || !member.canEdit;
  const text =
    pending && shift === WORK_SCHEDULE_SHIFT.None ? t("Timekeeping:Board:CancelSaved") : shiftLabel(shift);
  const cls = [
    "ws-dcard",
    `ws-k-${SHIFT_CODE[shift].css}`,
    readOnly && "ws-dcard--ro",
    day.isToday && "ws-dcard--today",
    pending && "ws-dcard--pending",
    day.isWeekend && "ws-dcard--weekend",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      type="button"
      className={cls}
      aria-disabled={readOnly}
      aria-label={t(
        "Timekeeping:Board:DayAria",
        `${dowShort(day.dow)} ${day.day}/${month}`,
        shiftLabel(shift) + (pending ? t("Timekeeping:Board:PendingSuffix") : ""),
      )}
      onMouseDown={(e) => paint.onMouseDown(member, day, e)}
      onMouseEnter={() => paint.onMouseEnter(member, day)}
      onClick={(e) => paint.onClick(member, day, e)}
    >
      <span className="ws-dtop">
        <span className="ws-dnum">{day.day}</span>
        <span className="ws-grow" />
        {pending ? <span className="ws-badge ws-badge--pending">{t("Timekeeping:Board:PendingBadge")}</span> : null}
      </span>
      <span className="ws-dlabel">{text}</span>
    </button>
  );
}
