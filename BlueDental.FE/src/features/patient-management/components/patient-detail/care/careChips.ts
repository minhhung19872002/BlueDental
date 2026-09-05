import {
  CARE_OUTCOME,
  CARE_STATUS,
  CARE_TYPE,
  type CareStatsDto,
  type GetCareRecordListInput,
} from "@/features/cskh/api/careApi";

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
export const CARE_CHIPS: readonly CareChip[] = [
  {
    key: "cared",
    label: "Đã chăm sóc",
    tone: "slate",
    stat: "succeeded",
    params: { status: CARE_STATUS.Succeeded },
  },
  { key: "good", label: "Tốt", tone: "green", stat: "good", params: { outcome: CARE_OUTCOME.Good } },
  { key: "fair", label: "Khá", tone: "blue", stat: "fair", params: { outcome: CARE_OUTCOME.Fair } },
  {
    key: "normal",
    label: "Bình thường",
    tone: "amber",
    stat: "normal",
    params: { outcome: CARE_OUTCOME.Normal },
  },
  {
    key: "complaint",
    label: "Khiếu nại",
    tone: "red",
    stat: "complaint",
    params: { outcome: CARE_OUTCOME.Complaint },
  },
  {
    key: "special",
    label: "Đặc biệt",
    tone: "red",
    stat: "special",
    params: { type: CARE_TYPE.Special },
    dividerBefore: true,
  },
  {
    key: "periodic",
    label: "Định kỳ",
    tone: "slate",
    stat: "periodic",
    params: { type: CARE_TYPE.Periodic },
  },
  { key: "base", label: "Cơ bản", tone: "green", stat: "base", params: { type: CARE_TYPE.Base } },
];

export function careChipParams(key: CareChipKey | null): CareChip["params"] {
  return CARE_CHIPS.find((chip) => chip.key === key)?.params ?? {};
}
