import { useQuery } from "@tanstack/react-query";
import { patientApi } from "./patientApi";
import { adaptPatient } from "./patientAdapters";
import type { PatientListQuery } from "../types/patient";

export const patientKeys = {
  all: ["patients"] as const,
  lists: () => [...patientKeys.all, "list"] as const,
  list: (params: PatientListQuery) =>
    [...patientKeys.lists(), params] as const,
  details: () => [...patientKeys.all, "detail"] as const,
  detail: (id: string) => [...patientKeys.details(), id] as const,
};

export function usePatientList(params: PatientListQuery) {
  return useQuery({
    queryKey: patientKeys.list(params),
    queryFn: () => patientApi.list(params),
  });
}

export function usePatient(id: string) {
  return useQuery({
    queryKey: patientKeys.detail(id),
    queryFn: async () => {
      const dto = await patientApi.get(id);
      return adaptPatient(dto);
    },
    enabled: Boolean(id),
  });
}

/**
 * The patient exactly as the server sends it. usePatient adapts the row into
 * the list's view model; the editor binds to the real field names.
 */
export function usePatientDto(id: string) {
  return useQuery({
    queryKey: [...patientKeys.detail(id), "dto"],
    queryFn: () => patientApi.get(id),
    enabled: Boolean(id),
  });
}
