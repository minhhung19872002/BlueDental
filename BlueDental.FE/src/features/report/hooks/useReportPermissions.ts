import { useAuthStore } from "@/features/auth/store/authStore";

/**
 * The reference gates every report button with `can(subject, action)`; the
 * subjects and actions below are the ones its bundle asks for, spelled the
 * way the server grants them (`BlueDental.<subject>.<action>`).
 */
export const REPORT_PERMISSION = {
  incomeRead: "BlueDental.reportIncome.read",
  incomeCreate: "BlueDental.reportIncome.create",
  incomeUpdate: "BlueDental.reportIncome.update",
  incomeExport: "BlueDental.reportIncome.export",
  costRead: "BlueDental.reportCost.read",
  costCreate: "BlueDental.reportCost.create",
  costUpdate: "BlueDental.reportCost.update",
  costDelete: "BlueDental.reportCost.delete",
  costApprove: "BlueDental.reportCost.approve",
  costExport: "BlueDental.reportCost.export",
  cashflowCategoryRead: "BlueDental.reportCashflowCategory.read",
  cashflowCategoryCreate: "BlueDental.reportCashflowCategory.create",
  transferRead: "BlueDental.reportTransfer.read",
  transferUpdate: "BlueDental.reportTransfer.update",
  transferDelete: "BlueDental.reportTransfer.delete",
  transferDeposit: "BlueDental.reportTransfer.deposit",
  transferWithdraw: "BlueDental.reportTransfer.withdraw",
  transferTransfer: "BlueDental.reportTransfer.transfer",
  transferExport: "BlueDental.reportTransfer.export",
  transferCategoryRead: "BlueDental.reportTransferCategory.read",
  transferCategoryCreate: "BlueDental.reportTransferCategory.create",
} as const;

export type ReportPermission = (typeof REPORT_PERMISSION)[keyof typeof REPORT_PERMISSION];

/** True when the signed-in user holds the given report permission. */
export function useReportPermission(permission: ReportPermission): boolean {
  return useAuthStore((s) => s.hasPermission(permission));
}
