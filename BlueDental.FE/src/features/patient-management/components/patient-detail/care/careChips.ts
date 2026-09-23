import {
  CARE_OUTCOME,
  CARE_STATUS,
  CARE_TYPE,
  type CareStatsDto,
  type GetCareRecordListInput,
} from "@/features/cskh/api/careApi";
import { t } from "@/lib/i18n";

export type CareChipKey =
  | "cared"
  | "good"
  | "fair"
  | "normal"
  | "complaint"
  | "special"
  | "periodic"
  | "base";

export type CareChipTone = "slate" | "green" | "blue" | "amber" | "red";

export interface CareChip {
  key: CareChipKey;
  /** Vietnamese label — also the i18n key. */
  label: string;
  tone: CareChipTone;
  /** Which stats counter the chip shows. */
  stat: keyof CareStatsDto;
  /** The one list param the reference adds while the chip is pressed. */
  params: Pick<GetCareRecordListInput, "status" | "outcome" | "type">;
  /** The reference draws a rule between the ratings and the groups. */
  dividerBefore?: boolean;
}

/**
 * The eight counters above the care log, in the reference's order: one for
 * "cared", four ratings, then three care groups. Single-select — pressing the
 * active chip clears the filter.
 */
export function careChips(): readonly CareChip[] {
  return [
    {
      key: "cared",
      label: t("Patient:Care:ChipCared"),
      tone: "slate",
      stat: "succeeded",
      params: { status: CARE_STATUS.Succeeded },
    },
    { key: "good", label: t("Patient:Care:OutcomeGood"), tone: "green", stat: "good", params: { outcome: CARE_OUTCOME.Good } },
    { key: "fair", label: t("Patient:Care:OutcomeFair"), tone: "blue", stat: "fair", params: { outcome: CARE_OUTCOME.Fair } },
    {
      key: "normal",
      label: t("Patient:Care:OutcomeNormal"),
      tone: "amber",
      stat: "normal",
      params: { outcome: CARE_OUTCOME.Normal },
    },
    {
      key: "complaint",
      label: t("Patient:Care:OutcomeComplaint"),
      tone: "red",
      stat: "complaint",
      params: { outcome: CARE_OUTCOME.Complaint },
    },
    {
      key: "special",
      label: t("Patient:Care:TypeSpecial"),
      tone: "red",
      stat: "special",
      params: { type: CARE_TYPE.Special },
      dividerBefore: true,
    },
    {
      key: "periodic",
      label: t("Patient:Care:TypePeriodic"),
      tone: "slate",
      stat: "periodic",
      params: { type: CARE_TYPE.Periodic },
    },
    { key: "base", label: t("Patient:Care:TypeBase"), tone: "green", stat: "base", params: { type: CARE_TYPE.Base } },
  ];
}

export function careChipParams(key: CareChipKey | null): CareChip["params"] {
  return careChips().find((chip) => chip.key === key)?.params ?? {};
}
