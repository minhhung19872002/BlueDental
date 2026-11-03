import { useMutation } from "@tanstack/react-query";
import { arrivalCallApi } from "./arrivalCallApi";

/** Calling up or seating a patient moves their visit, so every appointment reader refreshes. */
const INVALIDATES_APPOINTMENTS = { invalidates: ["appointment"] } as const;

export function useInviteArrival() {
  return useMutation({
    mutationFn: (id: string) => arrivalCallApi.invite(id),
    meta: INVALIDATES_APPOINTMENTS,
  });
}

export function useAdmitArrival() {
  return useMutation({
    mutationFn: (id: string) => arrivalCallApi.admit(id),
    meta: INVALIDATES_APPOINTMENTS,
  });
}
