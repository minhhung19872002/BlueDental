import dayjs from "dayjs";
import { t } from "@/lib/i18n";
import { formatDate } from "@/utils/format";
import { relationLabel, type PatientRelationType } from "@/utils/patientRelation";
import { GENDER, type GenderCode } from "../../types/patient";
import { ageByYear } from "../../utils/guardian";

const GENDER_KEY: Record<GenderCode, string> = {
  [GENDER.Male]: "Common:Gender:Male",
  [GENDER.Female]: "Common:Gender:Female",
  [GENDER.Other]: "Common:Gender:Other",
  [GENDER.PreferNotToSay]: "Common:Gender:PreferNotToSay",
};

/** "DH26 0012" — the clinic prefix and year set apart from the sequence, as the BA's mock prints it. */
export function spacedPatientCode(code: string): string {
  const match = /^(\D+\d{2})(\d+)$/.exec(code);
  return match ? `${match[1]} ${match[2]}` : code;
}

const lastVisit = (at: string | null) => (at ? t("Patient:SharedPhone:LastVisit", formatDate(at)) : null);

const joinDots = (parts: (string | null | undefined)[]) => parts.filter(Boolean).join(" · ");

interface HolderFacts {
  patientCode: string | null;
  dateOfBirth: string | null;
  lastVisitAt: string | null;
}

/** "DH26 0012 · Nam · 12/04/1982 · khám gần nhất 14/10/2026" — a row of the phone dropdown. */
export function holderLineWithGender(holder: HolderFacts & { gender: GenderCode | null }): string {
  return joinDots([
    holder.patientCode && spacedPatientCode(holder.patientCode),
    holder.gender ? t(GENDER_KEY[holder.gender]) : null,
    holder.dateOfBirth && dayjs(holder.dateOfBirth).format("DD/MM/YYYY"),
    lastVisit(holder.lastVisitAt),
  ]);
}

/** "DH26 0012 · 44 tuổi · khám gần nhất 14/10/2026" — a card on the record's Hồ sơ tab. */
export function holderLineWithAge(holder: HolderFacts): string {
  const age = ageByYear(holder.dateOfBirth);
  return joinDots([
    holder.patientCode && spacedPatientCode(holder.patientCode),
    age === null ? null : t("PatientRelation:Age", age),
    lastVisit(holder.lastVisitAt),
  ]);
}

/** "Hùng" from "Nguyễn Văn Hùng" — the chip names the other person by their given name. */
const givenName = (fullName: string) => fullName.trim().split(/\s+/).pop() ?? fullName;

/**
 * "Con của Hùng" — what a holder is to another one on the number. Worded with
 * the picker's own label (Vợ/Chồng, Bố/Mẹ…), as the BA's mock does.
 */
export function relationChip(type: PatientRelationType | null, relatedToName: string | null): string | null {
  if (type === null || !relatedToName) return null;
  return t("Patient:SharedPhone:RelationOf", relationLabel(type), givenName(relatedToName));
}
