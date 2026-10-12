import { useMemo } from "react";
import { usePatientFamily } from "@/hooks/usePatientFamily";
import { isFamilyRelation, type PatientRelationType } from "@/utils/patientRelation";

/** A relation on file between the Chủ hộ and another record. */
export interface KnownRelation {
  /** What the other record is to the Chủ hộ. */
  type: PatientRelationType;
  /** Follows a guardian card's kinship pill — changed on the card, not in the group. */
  setByGuardian: boolean;
}

/**
 * The family relations the Chủ hộ already has, by the other record's id — what
 * a family group's member rows show before anything is picked, and what the
 * server accepts in place of a relation given with the group.
 */
export function useHeadRelations(headId: string | undefined): ReadonlyMap<string, KnownRelation> {
  const { data: rows } = usePatientFamily(headId);
  return useMemo(
    () =>
      new Map(
        (rows ?? []).flatMap((row) =>
          row.type !== null && isFamilyRelation(row.type)
            ? [[row.relatedPatientId, { type: row.type, setByGuardian: row.setByGuardian }] as const]
            : [],
        ),
      ),
    [rows],
  );
}
