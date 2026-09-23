import { t } from "@/lib/i18n";

/**
 * Matches BlueDental.TreatmentManagement.TreatmentPlanStatus. Shared here
 * because both the treatment feature and the CSKH overview dialog render it,
 * and feature folders may not import from each other.
 */
export const PLAN_STATUS = {
  Draft: 1,
  PendingApproval: 2,
  Approved: 3,
  InProgress: 4,
  Completed: 5,
  Cancelled: 6,
} as const;
export type TreatmentPlanStatus = (typeof PLAN_STATUS)[keyof typeof PLAN_STATUS];

export const planStatusLabels = (): Record<TreatmentPlanStatus, string> => ({
  [PLAN_STATUS.Draft]: t("Common:PlanStatus:Draft"),
  [PLAN_STATUS.PendingApproval]: t("Common:PlanStatus:PendingApproval"),
  [PLAN_STATUS.Approved]: t("Common:PlanStatus:Approved"),
  [PLAN_STATUS.InProgress]: t("Common:PlanStatus:InProgress"),
  [PLAN_STATUS.Completed]: t("Common:PlanStatus:Completed"),
  [PLAN_STATUS.Cancelled]: t("Common:PlanStatus:Cancelled"),
});
