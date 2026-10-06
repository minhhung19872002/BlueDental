import { t } from "@/lib/i18n";
import { PENALTY_ACTION, PENALTY_STATUS, type PenaltyAction, type PenaltyStatus } from "../../api/staffPenaltyApi";

/** Label key and pill modifier per status — the pill's colours live in staff-penalty.css. */
export const PENALTY_STATUS_CONFIG: Record<PenaltyStatus, { label: string; tone: string }> = {
  [PENALTY_STATUS.Draft]: { label: "StaffPenalty:Status:Draft", tone: "draft" },
  [PENALTY_STATUS.Approved]: { label: "StaffPenalty:Status:Approved", tone: "approved" },
  [PENALTY_STATUS.Cancelled]: { label: "StaffPenalty:Status:Cancelled", tone: "cancelled" },
};

export const PENALTY_ACTION_LABEL: Record<PenaltyAction, string> = {
  [PENALTY_ACTION.Reminder]: "StaffPenalty:Action:Reminder",
  [PENALTY_ACTION.Warning]: "StaffPenalty:Action:Warning",
  [PENALTY_ACTION.Fine]: "StaffPenalty:Action:Fine",
  [PENALTY_ACTION.Other]: "StaffPenalty:Action:Other",
};

export type StatusFilterKey = "all" | PenaltyStatus;

/** The pills above the table, in order. */
export function statusFilterTabs(): { key: StatusFilterKey; label: string }[] {
  return [
    { key: "all", label: t("StaffPenalty:Status:All") },
    ...Object.values(PENALTY_STATUS).map((status) => ({
      key: status,
      label: t(PENALTY_STATUS_CONFIG[status].label),
    })),
  ];
}

export function actionOptions(): { value: PenaltyAction; label: string }[] {
  return Object.values(PENALTY_ACTION).map((action) => ({ value: action, label: t(PENALTY_ACTION_LABEL[action]) }));
}
