import type { PatientRelationRow } from "@/hooks/usePatientFamily";
import { GUARDIAN_DIRECTION, RELATION_SOURCE } from "@/utils/patientRelation";
import type { GuardianDraft } from "./guardian";

/**
 * One person in "Gia đình & Quan hệ" (owner, 2026-10-12): a guardian card of
 * the hồ sơ, staged until its Lưu, or a person the server relates to it. A
 * guardian picked from a patient record and that record's relation row are
 * the same person, so they make one entry.
 */
export type FamilyPerson =
  | { kind: "guardian"; key: string; index: number; guardian: GuardianDraft; row: PatientRelationRow | null }
  | { kind: "relation"; key: string; row: PatientRelationRow };

/**
 * The editor's guardians first, in their order, each joined with its record's
 * row; then everyone else, family before friends and colleagues. A guardian
 * the editor has just removed still comes back from the server until the hồ
 * sơ is saved — its guardian-only row is dropped, a declared relation stays.
 */
export function buildFamilyPeople(guardians: GuardianDraft[], rows: PatientRelationRow[]): FamilyPerson[] {
  const claimed = new Set<string>();
  const people: FamilyPerson[] = guardians.map((guardian, index) => {
    const row = guardian.linkedPatientId ? (rows.find((r) => r.relatedPatientId === guardian.linkedPatientId) ?? null) : null;
    if (row) claimed.add(row.relatedPatientId);
    return { kind: "guardian", key: `g-${guardian.uid}`, index, guardian, row };
  });

  const others = rows
    .filter((row) => !claimed.has(row.relatedPatientId))
    .filter((row) => !(row.source === RELATION_SOURCE.Guardian && row.guardianDirection === GUARDIAN_DIRECTION.GuardsPatient))
    .sort((a, b) => Number(b.isFamily) - Number(a.isFamily));

  return [...people, ...others.map((row): FamilyPerson => ({ kind: "relation", key: `r-${row.relatedPatientId}`, row }))];
}

/** A row the relation list may edit or delete: declared here, not owned by a guardian card. */
export const isEditableRelation = (row: PatientRelationRow) => row.id !== null && !row.setByGuardian;

/** A tie with no declared relation yet — a family-group member or a legal guardian; "Chọn quan hệ" writes one. */
export const needsRelation = (row: PatientRelationRow) => row.id === null && row.type === null;
