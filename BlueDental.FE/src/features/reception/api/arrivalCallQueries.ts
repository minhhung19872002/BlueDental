import { useQuery } from "@tanstack/react-query";
import { arrivalCallApi } from "./arrivalCallApi";

/** Root of the "Đã đến" panel's keys; an appointment write refreshes it (queryEntities). */
export const arrivalCallKeys = {
  all: ["arrival-calls"] as const,
  waiting: (branchId: string | undefined) => [...arrivalCallKeys.all, "waiting", branchId] as const,
  invited: (branchId: string | undefined) => [...arrivalCallKeys.all, "invited", branchId] as const,
};

/** The caller's own waiting patients — every doctor's for an admin. */
export function useWaitingArrivals(branchId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: arrivalCallKeys.waiting(branchId),
    queryFn: arrivalCallApi.getWaiting,
    enabled,
  });
}

/** Patients a doctor called up, for whoever may seat them. */
export function useInvitedArrivals(branchId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: arrivalCallKeys.invited(branchId),
    queryFn: arrivalCallApi.getInvited,
    enabled,
  });
}
