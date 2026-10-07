import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useDebounce } from "@/hooks/useDebounce";
import { patientApi } from "./patientApi";
import { adaptPatient } from "./patientAdapters";
import type { GuardianCandidate, PatientListQuery } from "../types/patient";

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

/**
 * "Quét CCCD" asks once per scan, on demand — not a query bound to render.
 * Never served stale: the record may have been created since the last scan.
 */
export function useNationalIdLookup() {
  const queryClient = useQueryClient();

  return useCallback(
    (nationalId: string) =>
      queryClient.fetchQuery({
        queryKey: [...patientKeys.all, "national-id", nationalId] as const,
        queryFn: () => patientApi.findByNationalId(nationalId),
        staleTime: 0,
      }),
    [queryClient],
  );
}

/** What the guardian search box asked, and what came back for it. */
export interface GuardianCandidateResults {
  /** The text these rows answer — a kept placeholder answers an older one. */
  keyword: string;
  items: GuardianCandidate[];
}

const guardianCandidateKey = (keyword: string, excludeId?: string) =>
  [...patientKeys.all, "guardian-candidates", keyword, excludeId ?? null] as const;

const fetchGuardianCandidates = async (
  keyword: string,
  excludeId?: string,
): Promise<GuardianCandidateResults> => ({
  keyword,
  items: await patientApi.guardianCandidates(keyword, excludeId),
});

/**
 * "Tìm người giám hộ đã có hồ sơ" as the desk types: hồ sơ and guardians
 * already declared for other patients (BA 2026-10-07, R-787). Nothing is
 * asked for an empty box.
 */
export function useGuardianCandidates(keyword: string, excludeId?: string) {
  const debounced = useDebounce(keyword, 300);
  return useQuery({
    queryKey: guardianCandidateKey(debounced, excludeId),
    queryFn: () => fetchGuardianCandidates(debounced, excludeId),
    enabled: debounced !== "",
    placeholderData: (previous) => previous,
  });
}

/**
 * The same search the moment Enter or "Tìm & điền" is pressed, rather than
 * after the debounce. Never served stale: someone may have been declared since.
 */
export function useFindGuardianCandidates() {
  const queryClient = useQueryClient();

  return useCallback(
    (keyword: string, excludeId?: string) =>
      queryClient.fetchQuery({
        queryKey: guardianCandidateKey(keyword, excludeId),
        queryFn: () => fetchGuardianCandidates(keyword, excludeId),
        staleTime: 0,
      }),
    [queryClient],
  );
}

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
