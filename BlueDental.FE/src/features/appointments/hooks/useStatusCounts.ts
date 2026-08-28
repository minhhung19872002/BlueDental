import { useMemo } from "react";
import type { AppointmentDto, AppointmentStatus } from "../types/appointment";

const STATUS_GROUPS: { key: string; statuses: AppointmentStatus[] }[] = [
  { key: "scheduled", statuses: ["scheduled", "confirmed"] },
  { key: "arrived", statuses: ["inProgress", "completed"] },
  { key: "cancelled", statuses: ["cancelled"] },
  { key: "late", statuses: ["noShow"] },
  { key: "temporary", statuses: [] },
  { key: "converted", statuses: [] },
];

export function useStatusCounts(appointments: AppointmentDto[]) {
  return useMemo(() => {
    const counts = new Map<string, number>();
    for (const group of STATUS_GROUPS) {
      counts.set(
        group.key,
        appointments.filter((a) => group.statuses.includes(a.status)).length,
      );
    }
    return counts;
  }, [appointments]);
}

export { STATUS_GROUPS };
