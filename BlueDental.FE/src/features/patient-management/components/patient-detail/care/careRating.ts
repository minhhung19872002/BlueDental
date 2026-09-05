import { CARE_OUTCOME, type CareOutcome } from "@/features/cskh/api/careApi";

export type CareRatingTone = "good" | "fair" | "normal" | "complaint";

export interface CareRating {
  value: CareOutcome;
  /** Vietnamese label — also the i18n key. */
  label: string;
  tone: CareRatingTone;
}

/** "Mức độ hài lòng", in the reference's order. */
export const CARE_RATINGS: readonly CareRating[] = [
  { value: CARE_OUTCOME.Good, label: "Tốt", tone: "good" },
  { value: CARE_OUTCOME.Fair, label: "Khá", tone: "fair" },
  { value: CARE_OUTCOME.Normal, label: "Bình thường", tone: "normal" },
  { value: CARE_OUTCOME.Complaint, label: "Khiếu nại", tone: "complaint" },
];

const DEFAULT_RATING = CARE_RATINGS[1];

/** An unrated record reads as "Khá" — the reference's default, in the form and the table alike. */
export function ratingOf(outcome: CareOutcome | null | undefined): CareRating {
  return CARE_RATINGS.find((rating) => rating.value === outcome) ?? DEFAULT_RATING;
}
