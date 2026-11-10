import { t } from "@/lib/i18n";
import type { ScheduleGroupVm } from "../../types/workSchedule";
import { groupName } from "../../utils/workScheduleText";

interface Props {
  groups: readonly ScheduleGroupVm[];
  selectedId: string | null;
  onSelect: (staffId: string) => void;
}

/** The person view's left list, grouped by team. */
export function PersonList({ groups, selectedId, onSelect }: Props) {
  return (
    <aside className="ws-plist" aria-label={t("Timekeeping:Board:StaffListAria")}>
      {groups.map((g) => (
        <div key={g.key} className="ws-plist-group">
          <div className="ws-plist-head">
            <span className={`ws-dot ws-tone-${g.colorIndex}`} />
            {groupName(g)}
          </div>
          {g.members.map((m) => (
            <button
              key={m.staffId}
              type="button"
              aria-current={m.staffId === selectedId}
              className={["ws-pitem", m.staffId === selectedId && "ws-pitem--on"].filter(Boolean).join(" ")}
              onClick={() => onSelect(m.staffId)}
            >
              <span className={`ws-avatar ws-tone-${m.colorIndex}`}>{m.initials}</span>
              <span className="ws-gtext">
                <span className="ws-name">{m.fullName}</span>
                <span className="ws-sub">{m.roleLabel}</span>
              </span>
            </button>
          ))}
        </div>
      ))}
      {groups.length === 0 ? <div className="ws-empty">{t("Timekeeping:Board:NoMatch")}</div> : null}
    </aside>
  );
}
