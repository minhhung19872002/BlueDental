import { DownOutlined } from "@ant-design/icons";
import { t } from "@/lib/i18n";
import type { ScheduleDraft } from "../../hooks/useScheduleDraft";
import type { SchedulePaint } from "../../hooks/useSchedulePaint";
import type { ScheduleDay, ScheduleGroupVm, ScheduleMemberVm } from "../../types/workSchedule";
import { formatUnits, workUnits } from "../../utils/workScheduleShift";
import { groupName } from "../../utils/workScheduleText";
import { ScheduleCell, dayColumnClass } from "./ScheduleCell";

export interface GridContext {
  days: readonly ScheduleDay[];
  month: number;
  draft: ScheduleDraft;
  paint: SchedulePaint;
  onOpenPerson: (staffId: string) => void;
}

interface Props {
  group: ScheduleGroupVm;
  expanded: boolean;
  onToggle: (key: string) => void;
  ctx: GridContext;
}

const unitsOf = (member: ScheduleMemberVm, ctx: GridContext) =>
  ctx.days.reduce((sum, day) => sum + workUnits(ctx.draft.shiftOf(member, day.date)), 0);

function MemberRow({ member, ctx }: { member: ScheduleMemberVm; ctx: GridContext }) {
  return (
    <div className="ws-row">
      <div className="ws-namecol ws-namecol--member">
        <span className={`ws-avatar ws-tone-${member.colorIndex}`}>{member.initials}</span>
        <button
          type="button"
          className="ws-namebtn"
          title={t("Timekeeping:Board:OpenPerson")}
          onClick={() => ctx.onOpenPerson(member.staffId)}
        >
          <span className="ws-name">{member.fullName}</span>
          <span className="ws-sub">
            {member.roleLabel
              ? t("Timekeeping:Board:RoleUnits", member.roleLabel, formatUnits(unitsOf(member, ctx)))
              : t("Timekeeping:Board:Units", formatUnits(unitsOf(member, ctx)))}
          </span>
        </button>
      </div>
      {ctx.days.map((day) => (
        <ScheduleCell
          key={day.date}
          member={member}
          day={day}
          month={ctx.month}
          shift={ctx.draft.shiftOf(member, day.date)}
          pending={ctx.draft.isPending(member.staffId, day.date)}
          paint={ctx.paint}
        />
      ))}
    </div>
  );
}

/** A team's header row (toggle, head-count, công) and, when open, its people. */
export function ScheduleGroupRows({ group, expanded, onToggle, ctx }: Props) {
  const total = group.members.reduce((sum, m) => sum + unitsOf(m, ctx), 0);
  return (
    <>
      <div className="ws-row ws-row--group">
        <div className="ws-namecol ws-namecol--group">
          <button type="button" className="ws-gtoggle" aria-expanded={expanded} onClick={() => onToggle(group.key)}>
            <DownOutlined className={["ws-chev", expanded && "ws-chev--open"].filter(Boolean).join(" ")} />
            <span className={`ws-dot ws-tone-${group.colorIndex}`} />
            <span className="ws-gtext">
              <span className="ws-name">{groupName(group)}</span>
              <span className="ws-sub">
                {t("Timekeeping:Board:GroupSummary", group.members.length, formatUnits(total))}
              </span>
            </span>
          </button>
        </div>
        {ctx.days.map((day) => (
          <div key={day.date} className={dayColumnClass(day)} />
        ))}
      </div>
      {expanded ? group.members.map((m) => <MemberRow key={m.staffId} member={m} ctx={ctx} />) : null}
    </>
  );
}
