import type { Dayjs } from "dayjs";
import { t } from "@/lib/i18n";
import { CARE_TYPE, type CareType } from "./api/careApi";

/** URL `page=` keys of the care-type tabs, reference order then our additions. */
export type CareTabKey =
  | "after-treatment"
  | "birthday"
  | "remind-appointment"
  | "no-service"
  | "missed-appointment"
  | "cancelled-appointment"
  | "periodic"
  | "special"
  | "complaint";

export type CareDateMode = "day" | "week" | "month";

const CARE_DATE_MODES: readonly CareDateMode[] = ["day", "week", "month"];

/** URL `care_dateMode=` value → validated mode; the page opens on this month (owner, 2026-10-05). */
export function careDateModeOf(value: string | null): CareDateMode {
  return CARE_DATE_MODES.includes(value as CareDateMode) ? (value as CareDateMode) : "month";
}

/**
 * How a tab tracks care: "contact" is the two-state Đã liên hệ / Chưa liên hệ
 * of Sau điều trị; "result" is the Thành công / Thất bại flow of the others.
 */
export type CareStatusModel = "contact" | "result";

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
  statusModel: CareStatusModel;
}

export const CARE_TABS: readonly CareTabConfig[] = [
  {
    key: "after-treatment",
    type: CARE_TYPE.AfterTreatment,
    label: () => t("CSKH:Type:AfterTreatment"),
    showDoctor: true,
    showCareStaff: false,
    showCreate: false,
    showSend: false,
    fileHeart: null,
    wideTable: false,
    statusModel: "contact",
  },
  {
    key: "birthday",
    type: CARE_TYPE.Birthday,
    label: () => t("CSKH:Type:Birthday"),
    showDoctor: false,
    showCareStaff: false,
    showCreate: false,
    showSend: true,
    fileHeart: null,
    wideTable: false,
    statusModel: "contact",
  },
  {
    key: "remind-appointment",
    type: CARE_TYPE.AppointmentReminder,
    label: () => t("CSKH:Type:AppointmentReminder"),
    showDoctor: true,
    showCareStaff: true,
    showCreate: false,
    showSend: true,
    fileHeart: null,
    wideTable: true,
    statusModel: "contact",
  },
  {
    key: "no-service",
    type: CARE_TYPE.NoService,
    label: () => t("CSKH:Type:NoService"),
    showDoctor: true,
    showCareStaff: true,
    showCreate: false,
    showSend: false,
    fileHeart: "result",
    wideTable: false,
    statusModel: "result",
  },
  {
    // Owner, 2026-10-05: bookings 5+ minutes past their time with no arrival.
    key: "missed-appointment",
    type: CARE_TYPE.MissedAppointment,
    label: () => t("CSKH:Type:MissedAppointment"),
    showDoctor: true,
    showCareStaff: false,
    showCreate: false,
    showSend: false,
    fileHeart: null,
    wideTable: true,
    statusModel: "contact",
  },
  {
    // Bug list #16 / feature checklist 2.7: patients who cancelled, windowed
    // by when they cancelled. Not on the reference (UNKNOWN_REFERENCE_BEHAVIOR).
    key: "cancelled-appointment",
    type: CARE_TYPE.CancelledAppointment,
    label: () => t("CSKH:Type:CancelledAppointment"),
    showDoctor: true,
    showCareStaff: false,
    showCreate: false,
    showSend: false,
    fileHeart: null,
    wideTable: true,
    statusModel: "contact",
  },
  {
    key: "periodic",
    type: CARE_TYPE.Periodic,
    label: () => t("CSKH:Type:Periodic"),
    showDoctor: true,
    showCareStaff: true,
    showCreate: true,
    showSend: false,
    fileHeart: null,
    wideTable: true,
    statusModel: "result",
  },
  {
    key: "special",
    type: CARE_TYPE.Special,
    label: () => t("CSKH:Type:Special"),
    showDoctor: true,
    showCareStaff: true,
    showCreate: true,
    showSend: false,
    fileHeart: null,
    wideTable: true,
    statusModel: "result",
  },
  {
    // Bug list #16 / feature checklist 2.6: complaints filed by hand, closed
    // with Thành công / Thất bại once handled. Not on the reference.
    key: "complaint",
    type: CARE_TYPE.Complaint,
    label: () => t("CSKH:Type:Complaint"),
    showDoctor: true,
    showCareStaff: true,
    showCreate: true,
    showSend: false,
    fileHeart: "result",
    wideTable: true,
    statusModel: "result",
  },
] as const;

export function careTabByKey(key: string | null): CareTabConfig {
  return CARE_TABS.find((tab) => tab.key === key) ?? CARE_TABS[0];
}

/** The subject the reference auto-fills when creating from the Tạo mới dialog. */
export function autoSubject(type: CareType): string {
  if (type === CARE_TYPE.Periodic) return "Customer Care - recurring";
  if (type === CARE_TYPE.Complaint) return "Customer Care - complaint";
  return "Customer Care - special";
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
