import { useQuery } from "@tanstack/react-query";
import { patientApi } from "./patientApi";
import { adaptPatient } from "./patientAdapters";
import type { PatientListQuery } from "../types/patient";

export const patientKeys = {
  all: ["patients"] as const,
  lists: () => [...patientKeys.all, "list"] as const,
  list: (params: PatientListQuery) => [...patientKeys.lists(), params] as const,
  details: () => [...patientKeys.all, "detail"] as const,
  detail: (id: string) => [...patientKeys.details(), id] as const,
  codeEstimate: () => [...patientKeys.all, "code-estimate"] as const,
  phone: (phone: string, excludeId?: string) =>
    [...patientKeys.all, "phone", phone, excludeId ?? null] as const,
};

export function usePatientList(params: PatientListQuery) {
  return useQuery({
    queryKey: patientKeys.list(params),
    queryFn: () => patientApi.list(params),
    // Keeping the previous page on screen is what lets the table dim under the
    // spinner instead of collapsing to an empty state on every keystroke.
    placeholderData: (previous) => previous,
  });
}

export function usePatient(id: string) {
  return useQuery({
    queryKey: patientKeys.detail(id),
    queryFn: async () => adaptPatient(await patientApi.get(id)),
    enabled: Boolean(id),
  });
}

/**
 * The patient exactly as the server sends it. usePatient adapts the record into
 * the profile's view model; the dialog binds to the real field names.
 */
export function usePatientDto(id: string) {
  return useQuery({
    queryKey: [...patientKeys.detail(id), "dto"],
    queryFn: () => patientApi.get(id),
    enabled: Boolean(id),
  });
}

/** Only asked for while the create dialog is open. */
export function usePatientCodeEstimate(enabled: boolean) {
  return useQuery({
    queryKey: patientKeys.codeEstimate(),
    queryFn: () => patientApi.codeEstimate(),
    enabled,
    // The suggestion goes stale the moment anyone else registers someone.
    staleTime: 0,
    gcTime: 0,
  });
}

/**
 * Whether a phone is already on another record in this branch.
 *
 * The reference checks as the field is typed rather than only on submit, so a
 * duplicate is caught before the form is filled in.
 */
export function usePhoneAvailability(phone: string, excludeId?: string) {
  const valid = /^\d{8,15}$/.test(phone);

  return useQuery({
    queryKey: patientKeys.phone(phone, excludeId),
    queryFn: () => patientApi.checkPhone(phone, excludeId),
    enabled: valid,
  });
}
