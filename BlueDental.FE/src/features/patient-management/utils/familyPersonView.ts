import { t } from "@/lib/i18n";
import { GUARDIAN_DIRECTION, relationLabel } from "@/utils/patientRelation";
import { GUARDIAN_RELATION, type GuardianRelationCode } from "../types/patient";
import type { FamilyPerson } from "./familyPeople";
import { ageByYear, RELATION_LABEL } from "./guardian";

/** A badge beside the name: what else ties the person to the record. */
export interface PersonBadge {
  key: string;
  label: string;
  color: "purple" | "gold" | "blue" | "default" | "orange";
}

/** What a person row shows, already worded. */
export interface FamilyPersonView {
  name: string;
  /** Their own hồ sơ, when they have one — the name links to it. */
  patientId: string | null;
  details: string;
  relation: string;
  isFamily: boolean;
  badges: PersonBadge[];
}

/** Bố, Mẹ, Ông, Bà, Anh/Chị ruột, Cô/Dì/Chú/Bác — the pills that say who the guardian is in the family. */
const hasKinship = (relation: number | null | undefined) =>
  relation != null && relation !== GUARDIAN_RELATION.LegalGuardian && relation !== GUARDIAN_RELATION.Other;

const pillLabel = (relation: number, note = "") => {
  const label = t(RELATION_LABEL[relation as GuardianRelationCode]);
  return note.trim() ? `${label} · ${note.trim()}` : label;
};

const joinDetails = (parts: (string | null | undefined)[]) => parts.filter(Boolean).join(" · ");

/** Wording of one row of "Người nhà & quan hệ". */
export function describePerson(person: FamilyPerson): FamilyPersonView {
  const badges: PersonBadge[] = [];
  const row = person.row;
  if (row?.inFamilyGroup) badges.push({ key: "group", label: t("PatientRelation:Source:FamilyGroup"), color: "blue" });

  if (person.kind === "guardian") {
    const { guardian } = person;
    const age = ageByYear(row?.relatedPatientDateOfBirth ?? guardian.dateOfBirth);
    badges.unshift({ key: "guardian", label: t("PatientRelation:Source:Guardian"), color: "purple" });
    if (guardian.isPrimaryContact) badges.push({ key: "primary", label: t("Patient:Guardian:PrimaryContact"), color: "gold" });
    if (!guardian.linkedPatientId) badges.push({ key: "norecord", label: t("Patient:Family:NoRecord"), color: "default" });
    if (guardian.id === null) badges.push({ key: "unsaved", label: t("Patient:Family:Unsaved"), color: "orange" });
    // A kinship pill is the relation; a legal guardian keeps a relation declared beside it.
    const relation =
      !hasKinship(guardian.relation) && row?.type
        ? relationLabel(row.type, row.relatedPatientGender)
        : guardian.relation
          ? pillLabel(guardian.relation, guardian.relationNote)
          : "";
    return {
      name: guardian.fullName,
      patientId: guardian.linkedPatientId,
      details: joinDetails([row?.relatedPatientCode, age !== null ? t("PatientRelation:Age", age) : null, guardian.phone]),
      relation,
      isFamily: true,
      badges,
    };
  }

  const r = person.row;
  const age = ageByYear(r.relatedPatientDateOfBirth);
  if (r.guardianDirection === GUARDIAN_DIRECTION.GuardedByPatient) {
    badges.unshift({ key: "ward", label: t("PatientRelation:Source:Ward"), color: "purple" });
  }
  // A ward's pill says what this record is to the ward, not the other way round.
  const relation = r.type
    ? relationLabel(r.type, r.relatedPatientGender)
    : r.guardianRelation && r.guardianDirection === GUARDIAN_DIRECTION.GuardsPatient
      ? pillLabel(r.guardianRelation)
      : t("Patient:Family:UnknownRelation");
  return {
    name: r.relatedPatientName,
    patientId: r.relatedPatientId,
    details: joinDetails([r.relatedPatientCode, age !== null ? t("PatientRelation:Age", age) : null, r.note]),
    relation,
    isFamily: r.isFamily,
    badges,
  };
}
