import { useQuery } from "@tanstack/react-query";
import { useBranchFilter } from "@/lib/clinicBranch";
import { ALWAYS_FRESH } from "@/lib/queryFreshness";
import dayjs from "dayjs";
import { api } from "@/lib/axios";
import type { PaymentChannel } from "./financeApi";

export interface PaymentStatSummaryDto {
  totalPrice: number;
  totalPaid: number;
  totalRefund: number;
  byCash: number;
  byBanking: number;
  byCard: number;
  byOutstandingDebt: number;
  refundByCash: number;
  refundByBanking: number;
  refundByCard: number;
  totalIncome: number;
  totalExpense: number;
  totalIncomeByCash: number;
  totalIncomeByBanking: number;
  totalExpenseByCash: number;
  totalExpenseByBanking: number;
  totalOutstandingDebt: number;
  totalRefundOutstandingDebt: number;
  totalArisingOutstandingDebt: number;
  totalArisingPrepaid: number;
  totalPrepaid: number;
  totalDebtTopup: number;
  totalReplaceCarryoverOutstandingDebt: number;
  totalActualReceived: number;
  patientVisits: number;
  appointmentCount: number;
}

export interface PatientHistoryRowDto {
  patientId: string;
  patientName: string;
  patientCode: string;
  date: string;
  staffName: string | null;
  serviceNames: string;
  quantity: number;
  effectiveAmount: number;
  totalPaid: number;
  isNewPatient: boolean;
}

export interface BusinessResultCategoryDto {
  categoryId: string;
  name: string;
  amount: number;
}

export interface BusinessResultDto {
  totalRevenue: number;
  treatmentIncome: number;
  otherIncome: number;
  treatmentRefund: number;
  expense: number;
  result: number;
  /** Indented rows under "Thu khác" — one per mục thu, empty when there are none. */
  otherIncomeByCategory: BusinessResultCategoryDto[];
  /** Indented rows under "Chi phí" — one per mục chi. */
  expenseByCategory: BusinessResultCategoryDto[];
}

export interface ClinicReportQuery {
  clinicBranchId?: string;
  fromDate?: string;
  toDate?: string;
}

export interface ClinicReportQueryWithDoctor extends ClinicReportQuery {
  doctorId?: string;
}

export interface ServiceLineDto {
  id: string;
  date: string;
  patientCode: string;
  patientName: string;
  patientLabel: string;
  counselorName: string;
  doctorName: string;
  serviceName: string;
  ticketCode: string;
  status: string;
  cancelled: boolean;
  quantity: number;
  totalAmount: number;
  paidAmount: number;
  branchName: string;
}

export interface PaymentLineDto {
  id: string;
  date: string;
  patientLabel: string;
  patientCode: string;
  patientName: string;
  paymentCode: string;
  createdBy: string;
  treatmentCode: string;
  branchName: string;
  serviceNames: string;
  /** Services of the plan that are cancelled: the reference chips them "(đã huỷ)". */
  cancelledServiceNames: string[];
  invoiceAmount: number;
  paidAmount: number;
  actualReceived: number;
  remainingPrepaid: number;
  channel: PaymentChannel;
  paymentInfo: string;
  note: string;
}

export interface RefundLineDto {
  id: string;
  date: string;
  patientLabel: string;
  patientCode: string;
  patientName: string;
  refundCode: string;
  serviceNames: string;
  refundAmount: number;
  channel: PaymentChannel;
  note: string;
}

export interface DebtLineDto {
  id: string;
  date: string;
  patientLabel: string;
  counselorName: string;
  doctorName: string;
  serviceName: string;
  /** "cancelled" | "replaced" | "" — the reference's "(đã hủy)" / "(thay thế)" chips. */
  status: string;
  quantity: number;
  debtIncurred: number;
  debtUsed: number;
  debtRefund: number;
}

export interface PrepaidLineDto {
  id: string;
  date: string;
  patientLabel: string;
  eventType: string;
  serviceName: string;
  paymentCode: string;
  doctorName: string;
  amount: number;
  balanceAfter: number;
}

export interface SalesSummaryDto {
  revenue: number;
  byCash: number;
  byBanking: number;
  byCard: number;
  byDebt: number;
  refund: number;
  refundByCash: number;
  refundByBanking: number;
  refundByCard: number;
  actualReceived: number;
  debtIncurred: number;
  debtUsed: number;
  debtRefund: number;
  prepaidIncurred: number;
  prepaidConsumed: number;
  prepaidRefund: number;
  prepaidBalance: number;
}

export interface DailyTotalDto {
  date: string;
  amount: number;
}

export interface OverviewRowDto {
  label: string;
  values: number[];
}

export interface MonthlyPointDto {
  month: string;
  a: number;
  b: number;
  c?: number;
}

export interface OverviewStatsDto {
  visits: OverviewRowDto[];
  appointments: OverviewRowDto[];
  payments: OverviewRowDto[];
  incomeExpense: OverviewRowDto[];
  visitSeries: MonthlyPointDto[];
  appointmentSeries: MonthlyPointDto[];
  paymentSeries: MonthlyPointDto[];
  incomeExpenseSeries: MonthlyPointDto[];
}

const BASE = "/v1/app/clinic-reports";

export const clinicReportKeys = {
  all: ["clinic-reports"] as const,
  paymentStat: (params: ClinicReportQuery) =>
    [...clinicReportKeys.all, "payment-stat", params] as const,
  patientHistory: (params: ClinicReportQuery) =>
    [...clinicReportKeys.all, "patient-history", params] as const,
  businessResult: (params: ClinicReportQuery) =>
    [...clinicReportKeys.all, "business-result", params] as const,
  serviceLines: (params: ClinicReportQueryWithDoctor) =>
    [...clinicReportKeys.all, "service-lines", params] as const,
  paymentLines: (params: ClinicReportQuery) =>
    [...clinicReportKeys.all, "payment-lines", params] as const,
  refundLines: (params: ClinicReportQuery) =>
    [...clinicReportKeys.all, "refund-lines", params] as const,
  debtLines: (params: ClinicReportQuery) =>
    [...clinicReportKeys.all, "debt-lines", params] as const,
  prepaidLines: (params: ClinicReportQuery) =>
    [...clinicReportKeys.all, "prepaid-lines", params] as const,
  salesSummary: (params: ClinicReportQuery) =>
    [...clinicReportKeys.all, "sales-summary", params] as const,
  overviewStats: (params: ClinicReportQuery) =>
    [...clinicReportKeys.all, "overview-stats", params] as const,
};

/**
 * One report read: scoped to the header's branch — "Tất cả chi nhánh" sends
 * none, which the server reads as every branch this account may see — unless
 * the caller names one, and re-read on every visit (see ALWAYS_FRESH).
 * Without the branch a clinic-wide account summed every branch here while
 * Quản lý thu chi showed one, so the tabs disagreed.
 */
function useReport<T, P extends ClinicReportQuery>(
  key: (params: P) => readonly unknown[],
  path: string,
  params: P,
) {
  const branch = useBranchFilter();
  const scoped: P = { ...params, clinicBranchId: params.clinicBranchId ?? branch };
  return useQuery({
    queryKey: key(scoped),
    queryFn: () => api.get<T>(`${BASE}/${path}`, { params: scoped }).then((r) => r.data),
    ...ALWAYS_FRESH,
  });
}

export function usePaymentStat(params: ClinicReportQuery) {
  return useReport<PaymentStatSummaryDto, ClinicReportQuery>(
    clinicReportKeys.paymentStat,
    "payment-stat",
    params,
  );
}

export function usePatientHistory(params: ClinicReportQuery) {
  return useReport<PatientHistoryRowDto[], ClinicReportQuery>(
    clinicReportKeys.patientHistory,
    "patient-history",
    params,
  );
}

export function useBusinessResult(params: ClinicReportQuery) {
  return useReport<BusinessResultDto, ClinicReportQuery>(
    clinicReportKeys.businessResult,
    "business-result",
    params,
  );
}

export interface RangeQuery {
  fromDate: string;
  toDate: string;
  doctorId?: string;
}

const range = (q: RangeQuery): ClinicReportQuery => ({ fromDate: q.fromDate, toDate: q.toDate });

export function useServiceLines(q: RangeQuery) {
  const params: ClinicReportQueryWithDoctor = { ...range(q), doctorId: q.doctorId };
  return useReport<ServiceLineDto[], ClinicReportQueryWithDoctor>(
    clinicReportKeys.serviceLines,
    "service-lines",
    params,
  );
}

export function usePaymentLines(q: RangeQuery) {
  return useReport<PaymentLineDto[], ClinicReportQuery>(
    clinicReportKeys.paymentLines,
    "payment-lines",
    range(q),
  );
}

export function useRefundLines(q: RangeQuery) {
  return useReport<RefundLineDto[], ClinicReportQuery>(
    clinicReportKeys.refundLines,
    "refund-lines",
    range(q),
  );
}

export function useDebtLines(q: RangeQuery) {
  return useReport<DebtLineDto[], ClinicReportQuery>(
    clinicReportKeys.debtLines,
    "debt-lines",
    range(q),
  );
}

export function usePrepaidLines(q: RangeQuery) {
  return useReport<PrepaidLineDto[], ClinicReportQuery>(
    clinicReportKeys.prepaidLines,
    "prepaid-lines",
    range(q),
  );
}

export function useSalesSummary(q: RangeQuery) {
  return useReport<SalesSummaryDto, ClinicReportQuery>(
    clinicReportKeys.salesSummary,
    "sales-summary",
    range(q),
  );
}

export function useOverviewStats(q: RangeQuery) {
  return useReport<OverviewStatsDto, ClinicReportQuery>(
    clinicReportKeys.overviewStats,
    "overview-stats",
    range(q),
  );
}

export function buildDailyTotals(
  from: string,
  to: string,
  lines: { date: string; amount: number }[],
): DailyTotalDto[] {
  const byDate = new Map<string, number>();
  for (const l of lines) byDate.set(l.date, (byDate.get(l.date) ?? 0) + l.amount);
  // Walk calendar days, not UTC instants, so a negative-offset browser does not skip a day.
  const days: string[] = [];
  const end = dayjs(to);
  for (let cur = dayjs(from); !cur.isAfter(end) && days.length < 400; cur = cur.add(1, "day")) {
    days.push(cur.format("YYYY-MM-DD"));
  }
  return days
    .reverse()
    .slice(0, 60)
    .map((date) => ({ date, amount: byDate.get(date) ?? 0 }));
}
