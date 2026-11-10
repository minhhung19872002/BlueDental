import type { ScheduleGroupVm } from "../types/workSchedule";

/**
 * The viewer's own row first (BA 2026-11-10, R-1192: "sort cái lịch của current
 * user lên đầu danh sách để họ book lịch cho dễ"): the group they are in moves
 * to the top, and they move to the top of it. Everything else keeps the
 * server's order. A viewer not on the board leaves it as it is.
 */
export function viewerFirst(groups: readonly ScheduleGroupVm[], viewerId: string | undefined): ScheduleGroupVm[] {
  const at = viewerId ? groups.findIndex((g) => g.members.some((m) => m.staffId === viewerId)) : -1;
  if (at < 0) return [...groups];
  const own = groups[at];
  const ownFirst: ScheduleGroupVm = {
    ...own,
    members: [
      ...own.members.filter((m) => m.staffId === viewerId),
      ...own.members.filter((m) => m.staffId !== viewerId),
    ],
  };
  return [ownFirst, ...groups.slice(0, at), ...groups.slice(at + 1)];
}
