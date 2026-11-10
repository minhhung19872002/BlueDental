import { useCallback, useMemo, useState } from "react";
import { matchesSearch } from "@/utils/foldForSearch";
import type { ScheduleGroupVm, ScheduleMemberVm } from "../types/workSchedule";

export interface ScheduleFilters {
  search: string;
  setSearch: (value: string) => void;
  /** Picked team keys; empty means every team. */
  teamKeys: readonly string[];
  toggleTeam: (key: string) => void;
  selectAllTeams: () => void;
  clearTeams: () => void;
  /** Groups after the team pick and the search, empty groups dropped. */
  visibleGroups: ScheduleGroupVm[];
}

const matchesMember = (member: ScheduleMemberVm, query: string) =>
  matchesSearch(member.fullName, query) || matchesSearch(member.roleLabel, query);

/** Search by name or role, and the "Tất cả team" multi-pick (prototype P0911). */
export function useScheduleFilters(groups: readonly ScheduleGroupVm[]): ScheduleFilters {
  const [search, setSearch] = useState("");
  const [teamKeys, setTeamKeys] = useState<readonly string[]>([]);

  const toggleTeam = useCallback((key: string) => {
    setTeamKeys((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  }, []);

  const selectAllTeams = useCallback(() => setTeamKeys(groups.map((g) => g.key)), [groups]);
  const clearTeams = useCallback(() => setTeamKeys([]), []);

  const visibleGroups = useMemo(() => {
    const picked = teamKeys.length ? groups.filter((g) => teamKeys.includes(g.key)) : groups;
    return picked
      .map((g) => ({ ...g, members: g.members.filter((m) => matchesMember(m, search)) }))
      .filter((g) => g.members.length > 0);
  }, [groups, teamKeys, search]);

  return { search, setSearch, teamKeys, toggleTeam, selectAllTeams, clearTeams, visibleGroups };
}
