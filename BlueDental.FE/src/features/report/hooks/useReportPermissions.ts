import { useAuthStore } from "@/features/auth/store/authStore";
import { abilityPermission } from "@/lib/permissionConstants";

/**
 * The reference gates every report button with `can(subject, action)`; the
 * subjects and actions below are the ones its bundle asks for.
 */
export const REPORT_PERMISSION = {
  salesRead: abilityPermission("reportSales", "read"),
  salesExport: abilityPermission("reportSales", "export"),
  incomeRead: abilityPermission("reportIncome", "read"),
  incomeCreate: abilityPermission("reportIncome", "create"),
  incomeUpdate: abilityPermission("reportIncome", "update"),
  incomeExport: abilityPermission("reportIncome", "export"),
  costRead: abilityPermission("reportCost", "read"),
  costCreate: abilityPermission("reportCost", "create"),
  costUpdate: abilityPermission("reportCost", "update"),
  costDelete: abilityPermission("reportCost", "delete"),
  costApprove: abilityPermission("reportCost", "approve"),
  costExport: abilityPermission("reportCost", "export"),
  cashflowCategoryRead: abilityPermission("reportCashflowCategory", "read"),
  cashflowCategoryCreate: abilityPermission("reportCashflowCategory", "create"),
  cashflowCategoryUpdate: abilityPermission("reportCashflowCategory", "update"),
  cashflowCategoryDelete: abilityPermission("reportCashflowCategory", "delete"),
  resultRead: abilityPermission("reportResult", "read"),
  resultExport: abilityPermission("reportResult", "export"),
  transferRead: abilityPermission("reportTransfer", "read"),
  transferUpdate: abilityPermission("reportTransfer", "update"),
  transferDelete: abilityPermission("reportTransfer", "delete"),
  transferDeposit: abilityPermission("reportTransfer", "deposit"),
  transferWithdraw: abilityPermission("reportTransfer", "withdraw"),
  transferTransfer: abilityPermission("reportTransfer", "transfer"),
  transferExport: abilityPermission("reportTransfer", "export"),
  transferCategoryRead: abilityPermission("reportTransferCategory", "read"),
  transferCategoryCreate: abilityPermission("reportTransferCategory", "create"),
  transferCategoryUpdate: abilityPermission("reportTransferCategory", "update"),
  transferCategoryDelete: abilityPermission("reportTransferCategory", "delete"),
} as const;

export type ReportPermission = (typeof REPORT_PERMISSION)[keyof typeof REPORT_PERMISSION];

/** True when the signed-in user holds the given report permission. */
export function useReportPermission(permission: ReportPermission): boolean {
  return useAuthStore((s) => s.hasPermission(permission));
}
