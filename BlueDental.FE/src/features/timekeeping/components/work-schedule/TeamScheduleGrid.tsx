import { useCallback, useState } from "react";
import { t } from "@/lib/i18n";
import type { ScheduleGroupVm } from "../../types/workSchedule";
import { dowShort } from "../../utils/workScheduleText";
import { ScheduleGroupRows, type GridContext } from "./ScheduleGroupRows";

interface Props {
  groups: readonly ScheduleGroupVm[];
  ctx: GridContext;
}

/** "Theo team": one row per person, one column per day of the month. */
export function TeamScheduleGrid({ groups, ctx }: Props) {
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => new Set());

  const handleToggle = useCallback((key: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  return (
    <div className="ws-team">
      <div className="ws-gridbox" role="region" aria-label={t("Timekeeping:Board:GridAria")}>
        <div className="ws-row ws-row--head">
          <div className="ws-namecol ws-namecol--head">{t("Timekeeping:Board:StaffByTeam")}</div>
          {ctx.days.map((day) => (
            <div
              key={day.date}
              className={["ws-dh", day.isWeekend && "ws-dh--weekend", day.isToday && "ws-dh--today"]
                .filter(Boolean)
                .join(" ")}
            >
              <span>{dowShort(day.dow)}</span>
              <b>{day.day}</b>
            </div>
          ))}
        </div>
        {groups.map((g) => (
          <ScheduleGroupRows
            key={g.key}
            group={g}
            expanded={!collapsed.has(g.key)}
            onToggle={handleToggle}
            ctx={ctx}
          />
        ))}
        {groups.length === 0 ? <div className="ws-empty">{t("Timekeeping:Board:NoMatch")}</div> : null}
      </div>
      <div className="ws-hint">{t("Timekeeping:Board:OpenPersonHint")}</div>
    </div>
  );
}
