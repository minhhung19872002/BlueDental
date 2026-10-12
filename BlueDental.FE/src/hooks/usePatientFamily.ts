import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/axios";
import type { PatientRelationType, RelationSource } from "@/utils/patientRelation";

/**
 * One person related to a patient, as `GET patient-relations` returns it: the
 * declared relation (Mối quan hệ 4.8) when there is one, and whether they are
 * also a guardian / ward (4.9) or in the family group (4.10). One row per person.
 *
 * Shared rather than feature-local: the patient record lists them, and the
 * family prepaid card suggests the owner's người nhà as members.
 */
export interface PatientRelationRow {
  /** The relationship's id; null when no relation is declared (a guardian or family-group tie only). */
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
  /** The guardian card's relation pill (GuardianRelation), when a guardian or ward of this patient. */
  guardianRelation: number | null;
  /** The relation follows a guardian card's kinship pill and is changed on the card. */
  setByGuardian: boolean;
  inFamilyGroup: boolean;
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
