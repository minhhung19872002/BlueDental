import { t } from "@/lib/i18n";

/**
 * Mối quan hệ (4.8) — shared by the patient record, Hồ sơ nhóm and the family
 * prepaid card, so all three word a relation the same way. Mirrors
 * BlueDental.PatientManagement.PatientRelationType: the value says what the
 * other record is to the one being read.
 */
export const PATIENT_RELATION = {
  Spouse: 1,
  Parent: 2,
  Child: 3,
  Sibling: 4,
  Grandparent: 5,
  Grandchild: 6,
  Relative: 7,
  Friend: 8,
  Colleague: 9,
  Other: 10,
} as const;
export type PatientRelationType = (typeof PATIENT_RELATION)[keyof typeof PATIENT_RELATION];

/** Mirrors BlueDental.PatientManagement.PatientRelationSource. */
export const RELATION_SOURCE = { Relationship: 1, Guardian: 2, FamilyGroup: 3 } as const;
export type RelationSource = (typeof RELATION_SOURCE)[keyof typeof RELATION_SOURCE];

/** Mirrors BlueDental.PatientManagement.GuardianDirection. */
export const GUARDIAN_DIRECTION = { GuardsPatient: 1, GuardedByPatient: 2 } as const;

const MALE = 1;
const FEMALE = 2;

const KEY: Record<PatientRelationType, string> = {
  [PATIENT_RELATION.Spouse]: "Spouse",
  [PATIENT_RELATION.Parent]: "Parent",
  [PATIENT_RELATION.Child]: "Child",
  [PATIENT_RELATION.Sibling]: "Sibling",
  [PATIENT_RELATION.Grandparent]: "Grandparent",
  [PATIENT_RELATION.Grandchild]: "Grandchild",
  [PATIENT_RELATION.Relative]: "Relative",
  [PATIENT_RELATION.Friend]: "Friend",
  [PATIENT_RELATION.Colleague]: "Colleague",
  [PATIENT_RELATION.Other]: "Other",
};

/** Words that change with the other person's gender: Bố / Mẹ, Vợ / Chồng, Ông / Bà… */
const GENDERED = new Set<PatientRelationType>([
  PATIENT_RELATION.Spouse,
  PATIENT_RELATION.Parent,
  PATIENT_RELATION.Sibling,
  PATIENT_RELATION.Grandparent,
]);

/** "Mẹ", "Chồng", "Con"… — what the other record is, worded by its gender when known. */
export function relationLabel(type: PatientRelationType, gender?: number | null): string {
  const key = KEY[type];
  if (!GENDERED.has(type)) return t(`PatientRelation:Type:${key}`);
  if (gender === MALE) return t(`PatientRelation:Type:${key}:Male`);
  if (gender === FEMALE) return t(`PatientRelation:Type:${key}:Female`);
  return t(`PatientRelation:Type:${key}`);
}

/** Người nhà — blood and marriage, not friends or colleagues (PatientRelationTypes.IsFamily). */
export function isFamilyRelation(type: PatientRelationType): boolean {
  return type !== PATIENT_RELATION.Friend && type !== PATIENT_RELATION.Colleague && type !== PATIENT_RELATION.Other;
}

/** The relation picker's options, gender-neutral; `familyOnly` for a family card's members. */
export function relationOptions(familyOnly = false): { value: PatientRelationType; label: string }[] {
  return (Object.values(PATIENT_RELATION) as PatientRelationType[])
    .filter((type) => !familyOnly || isFamilyRelation(type))
    .map((type) => ({ value: type, label: relationLabel(type) }));
}
