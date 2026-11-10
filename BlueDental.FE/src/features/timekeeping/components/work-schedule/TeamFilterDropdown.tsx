import { useEffect, useState } from "react";
import { Button } from "antd";
import { CheckOutlined, DownOutlined, TeamOutlined } from "@ant-design/icons";
import { t } from "@/lib/i18n";
import type { ScheduleFilters } from "../../hooks/useScheduleFilters";
import type { ScheduleGroupVm } from "../../types/workSchedule";
import { groupName } from "../../utils/workScheduleText";

interface Props {
  groups: readonly ScheduleGroupVm[];
  filters: ScheduleFilters;
}

function summaryOf(groups: readonly ScheduleGroupVm[], keys: readonly string[]): string {
  if (keys.length === 0 || keys.length >= groups.length) return t("Timekeeping:Board:AllTeams");
  if (keys.length === 1) {
    const only = groups.find((g) => g.key === keys[0]);
    return only ? groupName(only) : t("Timekeeping:Board:AllTeams");
  }
  return t("Timekeeping:Board:TeamsPicked", keys.length);
}

/** "Tất cả team" button with its pick-several list (prototype P0911). */
export function TeamFilterDropdown({ groups, filters }: Props) {
  const [open, setOpen] = useState(false);
  const { teamKeys } = filters;
  const narrowed = teamKeys.length > 0 && teamKeys.length < groups.length;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="ws-dd">
      <button
        type="button"
        className="ws-dd-btn"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={t("Timekeeping:Board:TeamFilterAria")}
        onClick={() => setOpen((v) => !v)}
      >
        <TeamOutlined className="ws-dd-icon" />
        <span className="ws-dd-summary">{summaryOf(groups, teamKeys)}</span>
        {narrowed ? <span className="ws-dd-count">{teamKeys.length}</span> : null}
        <DownOutlined className="ws-dd-caret" />
      </button>
      {open ? (
        <>
          <div className="ws-dd-scrim" onClick={() => setOpen(false)} />
          <div className="ws-dd-panel" role="listbox" aria-multiselectable="true" aria-label={t("Timekeeping:Board:PickTeam")}>
            <div className="ws-dd-head">
              <span className="ws-dd-title">{t("Timekeeping:Board:PickTeam")}</span>
              <button type="button" className="ws-dd-link" onClick={filters.selectAllTeams}>
                {t("Timekeeping:Board:SelectAll")}
              </button>
              <button type="button" className="ws-dd-link" onClick={filters.clearTeams}>
                {t("Timekeeping:Board:ClearAll")}
              </button>
            </div>
            {groups.map((g) => {
              const on = teamKeys.includes(g.key);
              return (
                <button
                  key={g.key}
                  type="button"
                  role="option"
                  aria-selected={on}
                  className={["ws-dd-opt", on && "ws-dd-opt--on"].filter(Boolean).join(" ")}
                  onClick={() => filters.toggleTeam(g.key)}
                >
                  <span className={`ws-dot ws-tone-${g.colorIndex}`} />
                  <span className="ws-dd-name">{groupName(g)}</span>
                  <span className="ws-sub">{t("Timekeeping:Board:PeopleCount", g.members.length)}</span>
                  {on ? <CheckOutlined className="ws-dd-check" /> : null}
                </button>
              );
            })}
            <div className="ws-dd-foot">
              <Button type="primary" size="small" onClick={() => setOpen(false)}>
                {t("Timekeeping:Board:Done")}
              </Button>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
