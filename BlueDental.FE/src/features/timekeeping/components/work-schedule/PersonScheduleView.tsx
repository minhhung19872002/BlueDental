import { useCallback } from "react";
import { Button } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { toast } from "sonner";
import { t } from "@/lib/i18n";
import { WORK_SCHEDULE_SHIFT } from "../../api/workScheduleApi";
import type { ScheduleGroupVm, ScheduleMemberVm } from "../../types/workSchedule";
import {
  breaksDayOffLimit,
  formatUnits,
  workUnits,
  worksAfternoon,
  worksMorning,
  type BrushShift,
} from "../../utils/workScheduleShift";
import { dowLong, groupName, shiftLabel } from "../../utils/workScheduleText";
import { PersonDayCard } from "./PersonDayCard";
import { PersonList } from "./PersonList";
import type { GridContext } from "./ScheduleGroupRows";

interface Props {
  groups: readonly ScheduleGroupVm[];
  person: ScheduleMemberVm | null;
  onSelect: (staffId: string) => void;
  brush: BrushShift;
  ctx: GridContext;
}

/** Monday-first header: Thứ 2 … Chủ nhật. */
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;

function statsOf(person: ScheduleMemberVm, ctx: GridContext) {
  let units = 0, mornings = 0, afternoons = 0, pending = 0;
  for (const day of ctx.days) {
    const shift = ctx.draft.shiftOf(person, day.date);
    units += workUnits(shift);
    if (worksMorning(shift)) mornings++;
    if (worksAfternoon(shift)) afternoons++;
    if (ctx.draft.isPending(person.staffId, day.date)) pending++;
  }
  return { units, mornings, afternoons, pending };
}

/** The empty days, earliest first, that `brush` can fill before the month passes the day-off limit. */
function datesWithinLimit(empty: readonly string[], brush: BrushShift, units: number, ctx: GridContext) {
  const taken: string[] = [];
  let total = units;
  for (const date of empty) {
    const next = total + workUnits(brush);
    if (breaksDayOffLimit(ctx.limit, total, next)) break;
    taken.push(date);
    total = next;
  }
  return taken;
}

/** "Từng bác sĩ / nhân viên": one person's month as day cards. */
export function PersonScheduleView({ groups, person, onSelect, brush, ctx }: Props) {
  const handleFill = useCallback(() => {
    if (!person) return;
    if (!person.canEdit) {
      toast.warning(t("Timekeeping:Board:NoPermission"));
      return;
    }
    const empty = ctx.days
      .filter((d) => !d.locked && d.dow !== 0)
      .filter((d) => ctx.draft.shiftOf(person, d.date) === WORK_SCHEDULE_SHIFT.None)
      .map((d) => d.date);
    if (empty.length === 0) {
      toast.info(t("Timekeeping:Board:FillNone"));
      return;
    }
    const max = ctx.limit?.max ?? 0;
    const fits = datesWithinLimit(empty, brush, statsOf(person, ctx).units, ctx);
    if (fits.length === 0) {
      toast.warning(t("Timekeeping:Board:DayOffLimit", max));
      return;
    }
    ctx.draft.setMany(person, fits, brush);
    if (fits.length < empty.length) toast.warning(t("Timekeeping:Board:FillLimited", shiftLabel(brush), fits.length, max));
    else toast.success(t("Timekeeping:Board:FillDone", shiftLabel(brush), fits.length));
  }, [brush, ctx.days, ctx.draft, person]);

  const team = person ? groups.find((g) => g.key === person.groupKey) : undefined;
  const stats = person ? statsOf(person, ctx) : null;
  const lead = ctx.days.length ? (ctx.days[0].dow + 6) % 7 : 0;
  const trail = (7 - ((lead + ctx.days.length) % 7)) % 7;

  return (
    <div className="ws-person">
      <PersonList groups={groups} selectedId={person?.staffId ?? null} onSelect={onSelect} />
      {person && stats ? (
        <div className="ws-person-main">
          <div className="ws-person-head">
            <span className={`ws-avatar ws-avatar--lg ws-tone-${person.colorIndex}`}>{person.initials}</span>
            <div className="ws-person-title">
              <span className="ws-person-name">{person.fullName}</span>
              <span className="ws-person-sub">
                {[person.roleLabel, team ? groupName(team) : null].filter(Boolean).join(" · ")}
              </span>
            </div>
            <Button icon={<PlusOutlined />} onClick={handleFill}>
              {t("Timekeeping:Board:FillEmpty", shiftLabel(brush))}
            </Button>
          </div>
          <div className="ws-stats">
            <div className="ws-stat"><div className={["ws-stat-v", ctx.limit && stats.units > ctx.limit.max && "ws-stat-v--over"].filter(Boolean).join(" ")}>{ctx.limit ? t("Timekeeping:Board:Stat:UnitsOfMax", formatUnits(stats.units), ctx.limit.max) : formatUnits(stats.units)}</div><div className="ws-stat-l">{t("Timekeeping:Board:Stat:Units")}</div></div>
            <div className="ws-stat"><div className="ws-stat-v ws-stat-v--s">{stats.mornings}</div><div className="ws-stat-l">{t("Timekeeping:Board:Stat:Mornings")}</div></div>
            <div className="ws-stat"><div className="ws-stat-v ws-stat-v--c">{stats.afternoons}</div><div className="ws-stat-l">{t("Timekeeping:Board:Stat:Afternoons")}</div></div>
            <div className="ws-stat"><div className="ws-stat-v ws-stat-v--p">{stats.pending}</div><div className="ws-stat-l">{t("Timekeeping:Board:Stat:Pending")}</div></div>
          </div>
          <div className="ws-cal">
            {WEEK_ORDER.map((dow) => (
              <div key={dow} className={["ws-calh", (dow === 0 || dow === 6) && "ws-calh--weekend"].filter(Boolean).join(" ")}>
                {dowLong(dow)}
              </div>
            ))}
            {Array.from({ length: lead }, (_, i) => <div key={`lead-${i}`} />)}
            {ctx.days.map((day) => (
              <PersonDayCard
                key={day.date}
                member={person}
                day={day}
                month={ctx.month}
                shift={ctx.draft.shiftOf(person, day.date)}
                pending={ctx.draft.isPending(person.staffId, day.date)}
                paint={ctx.paint}
              />
            ))}
            {Array.from({ length: trail }, (_, i) => <div key={`trail-${i}`} />)}
          </div>
        </div>
      ) : null}
    </div>
  );
}
