import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/axios";
import type { PatientRelationType, RelationSource } from "@/utils/patientRelation";

/**
 * One record related to a patient (Mối quan hệ 4.8, guardian links 4.9, family
 * group 4.10), as `GET patient-relations` returns it.
 *
 * Shared rather than feature-local: the patient record lists them, and the
 * family prepaid card suggests the owner's người nhà as members.
 */
export interface PatientRelationRow {
  /** The relationship's id; null for guardian and family-group rows (edited elsewhere). */
  id: string | null;
  source: RelationSource;
  guardianDirection: number | null;
  relatedPatientId: string;
  relatedPatientCode: string;
  relatedPatientName: string;
  relatedPatientGender: number;
  relatedPatientDateOfBirth: string | null;
  /** What the related record is to this patient; null for a family-group row. */
  type: PatientRelationType | null;
  isFamily: boolean;
  note: string | null;
}

export const patientRelationKeys = {
  all: ["patient-relations"] as const,
  list: (patientId: string) => [...patientRelationKeys.all, "list", patientId] as const,
  family: (patientId: string) => [...patientRelationKeys.all, "family", patientId] as const,
};

/** Người nhà of a patient — who a family prepaid card may be shared with. */
export function usePatientFamily(patientId: string | undefined) {
  return useQuery({
    queryKey: patientRelationKeys.family(patientId ?? "none"),
    queryFn: async () =>
      (
        await api.get<{ items: PatientRelationRow[] }>("/v1/app/patient-relations/family", {
          params: { patientId },
        })
      ).data.items,
    enabled: Boolean(patientId),
  });
}
