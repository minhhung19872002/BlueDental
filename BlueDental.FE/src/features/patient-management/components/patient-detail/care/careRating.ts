import { CARE_OUTCOME, type CareOutcome } from "@/features/cskh/api/careApi";
import { t } from "@/lib/i18n";

export type CareRatingTone = "good" | "fair" | "normal" | "complaint";

export interface CareRating {
  value: CareOutcome;
  label: string;
  tone: CareRatingTone;
}

export function careRatings(): readonly CareRating[] {
  return [
    { value: CARE_OUTCOME.Good, label: t("Patient:Care:OutcomeGood"), tone: "good" },
    { value: CARE_OUTCOME.Fair, label: t("Patient:Care:OutcomeFair"), tone: "fair" },
    { value: CARE_OUTCOME.Normal, label: t("Patient:Care:OutcomeNormal"), tone: "normal" },
    { value: CARE_OUTCOME.Complaint, label: t("Patient:Care:OutcomeComplaint"), tone: "complaint" },
  ];
}

export function ratingOf(outcome: CareOutcome | null | undefined): CareRating {
  const ratings = careRatings();
  return ratings.find((rating) => rating.value === outcome) ?? ratings[1];
}
