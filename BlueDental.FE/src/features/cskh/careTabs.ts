import type { Dayjs } from "dayjs";
import { t } from "@/lib/i18n";
import { CARE_TYPE, type CareType } from "./api/careApi";

/** URL `page=` keys of the 5 care-type tabs, reference order. */
export type CareTabKey =
  | "after-treatment"
  | "birthday"
  | "remind-appointment"
  | "periodic"
  | "special";

export type CareDateMode = "day" | "week" | "month";

const CARE_DATE_MODES: readonly CareDateMode[] = ["day", "week", "month"];

/** URL `care_dateMode=` value → validated mode, defaulting like the reference. */
export function careDateModeOf(value: string | null): CareDateMode {
  return CARE_DATE_MODES.includes(value as CareDateMode) ? (value as CareDateMode) : "day";
}

export interface CareTabConfig {
  key: CareTabKey;
  type: CareType;
  label: () => string;
  /** Toolbar matrix (docs/clone/pages/cskh-grouping.md). */
  showDoctor: boolean;
  showCareStaff: boolean;
  showCreate: boolean;
  /** Row-action matrix: send is on reminder + birthday; file-heart opens the result dialog. */
  showSend: boolean;
  fileHeart: "result" | null;
  /** Tabs with 9–10 columns overflow the card and scroll horizontally. */
  wideTable: boolean;
}

export const CARE_TABS: readonly CareTabConfig[] = [
  {
    key: "after-treatment",
    type: CARE_TYPE.AfterTreatment,
    label: () => t("Sau điều trị"),
    showDoctor: true,
    showCareStaff: false,
    showCreate: false,
    showSend: false,
    fileHeart: null,
    wideTable: false,
  },
  {
    key: "birthday",
    type: CARE_TYPE.Birthday,
    label: () => t("Chúc mừng sinh nhật"),
    showDoctor: false,
    showCareStaff: false,
    showCreate: false,
    showSend: true,
    fileHeart: "result",
    wideTable: false,
  },
  {
    key: "remind-appointment",
    type: CARE_TYPE.AppointmentReminder,
    label: () => t("Nhắc lịch hẹn"),
    showDoctor: true,
    showCareStaff: true,
    showCreate: false,
    showSend: true,
    fileHeart: "result",
    wideTable: true,
  },
  {
    key: "periodic",
    type: CARE_TYPE.Periodic,
    label: () => t("CSKH định kì"),
    showDoctor: true,
    showCareStaff: true,
    showCreate: true,
    showSend: false,
    fileHeart: null,
    wideTable: true,
  },
  {
    key: "special",
    type: CARE_TYPE.Special,
    label: () => t("CSKH đặc biệt"),
    showDoctor: true,
    showCareStaff: true,
    showCreate: true,
    showSend: false,
    fileHeart: null,
    wideTable: true,
  },
] as const;

export function careTabByKey(key: string | null): CareTabConfig {
  return CARE_TABS.find((tab) => tab.key === key) ?? CARE_TABS[0];
}

/** The subject the reference auto-fills when creating from the Tạo mới dialog. */
export function autoSubject(type: CareType): string {
  return type === CARE_TYPE.Periodic ? "Customer Care - recurring" : "Customer Care - special";
}

/**
 * Mode change resets the anchor the way the reference does: day → today,
 * week → Monday of this week, month → the 1st.
 */
export function anchorForMode(mode: CareDateMode, today: Dayjs): Dayjs {
  if (mode === "week") return today.startOf("week");
  if (mode === "month") return today.startOf("month");
  return today.startOf("day");
}

/** Inclusive local-time window sent to the API as ISO strings. */
export function careDateRange(mode: CareDateMode, anchor: Dayjs): { fromDate: string; toDate: string } {
  const unit = mode === "day" ? "day" : mode;
  return {
    fromDate: anchor.startOf(unit).toISOString(),
    toDate: anchor.endOf(unit).toISOString(),
  };
}
