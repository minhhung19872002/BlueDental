import { useQuery } from "@tanstack/react-query";
import type { ArrivalDoctorPick } from "../types/arrivalCall";
import { arrivalCallApi } from "./arrivalCallApi";

/** Root of the "Đã đến" panel's keys; an appointment write refreshes it (queryEntities). */
export const arrivalCallKeys = {
  all: ["arrival-calls"] as const,
  waiting: (branchId: string | undefined, pick: ArrivalDoctorPick) =>
    [...arrivalCallKeys.all, "waiting", branchId, pick] as const,
  invited: (branchId: string | undefined) => [...arrivalCallKeys.all, "invited", branchId] as const,
  doctors: (branchId: string | undefined) => [...arrivalCallKeys.all, "doctors", branchId] as const,
};

/**
 * The waiting patients of the doctors picked with the 👁 (R-1164).
 */
export function useWaitingArrivals(branchId: string | undefined, pick: ArrivalDoctorPick, enabled: boolean) {
  return useQuery({
    queryKey: arrivalCallKeys.waiting(branchId, pick),
    queryFn: () => arrivalCallApi.getWaiting(pick),
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

/** The doctors the 👁 on "Khách đã đến" offers (R-1164). */
export function useArrivalDoctors(branchId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: arrivalCallKeys.doctors(branchId),
    queryFn: arrivalCallApi.getDoctors,
    enabled,
    staleTime: 5 * 60_000,
  });
}
