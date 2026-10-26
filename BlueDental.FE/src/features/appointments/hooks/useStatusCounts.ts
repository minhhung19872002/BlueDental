import { useMemo } from "react";
import type { AppointmentDto, AppointmentStatus } from "../types/appointment";

interface StatusGroup {
  key: string;
  statuses: AppointmentStatus[];
  /** A chip that is not a set of statuses; it cuts across the others. */
  matches?: (a: AppointmentDto) => boolean;
}

const STATUS_GROUPS: StatusGroup[] = [
  { key: "scheduled", statuses: ["scheduled", "confirmed"] },
  { key: "arrived", statuses: ["inProgress", "completed"] },
  { key: "cancelled", statuses: ["cancelled"] },
  { key: "late", statuses: ["noShow"] },
  { key: "temporary", statuses: [] },
  // BA (R-1039): the old "Chuyển đổi" chip, same rule as on Tiếp nhận.
  { key: "revisit", statuses: [], matches: (a) => a.isRevisit },
];

function inGroup(group: StatusGroup, a: AppointmentDto): boolean {
  return group.matches ? group.matches(a) : group.statuses.includes(a.status);
}

/** Whether a pressed chip keeps `a`: a chip with no rule of its own keeps everything. */
export function keptByChip(group: StatusGroup | undefined, a: AppointmentDto): boolean {
  if (!group || (!group.matches && group.statuses.length === 0)) return true;
  return inGroup(group, a);
}

export function useStatusCounts(appointments: AppointmentDto[]) {
  return useMemo(() => {
    const counts = new Map<string, number>();
    for (const group of STATUS_GROUPS) {
      counts.set(group.key, appointments.filter((a) => inGroup(group, a)).length);
    }
    return counts;
  }, [appointments]);
}

export { STATUS_GROUPS };
