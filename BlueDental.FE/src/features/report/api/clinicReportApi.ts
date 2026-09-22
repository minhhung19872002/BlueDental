import { useQuery } from "@tanstack/react-query";
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

export function usePaymentStat(params: ClinicReportQuery) {
  return useQuery({
    queryKey: clinicReportKeys.paymentStat(params),
    queryFn: () =>
      api.get<PaymentStatSummaryDto>(`${BASE}/payment-stat`, { params }).then((r) => r.data),
  });
}

export function usePatientHistory(params: ClinicReportQuery) {
  return useQuery({
    queryKey: clinicReportKeys.patientHistory(params),
    queryFn: () =>
      api.get<PatientHistoryRowDto[]>(`${BASE}/patient-history`, { params }).then((r) => r.data),
  });
}

export function useBusinessResult(params: ClinicReportQuery) {
  return useQuery({
    queryKey: clinicReportKeys.businessResult(params),
    queryFn: () =>
      api.get<BusinessResultDto>(`${BASE}/business-result`, { params }).then((r) => r.data),
  });
}

export interface RangeQuery {
  fromDate: string;
  toDate: string;
  doctorId?: string;
}

export function useServiceLines(q: RangeQuery) {
  const params: ClinicReportQueryWithDoctor = { fromDate: q.fromDate, toDate: q.toDate, doctorId: q.doctorId };
  return useQuery({
    queryKey: clinicReportKeys.serviceLines(params),
    queryFn: () =>
      api.get<ServiceLineDto[]>(`${BASE}/service-lines`, { params }).then((r) => r.data),
  });
}

export function usePaymentLines(q: RangeQuery) {
  const params: ClinicReportQuery = { fromDate: q.fromDate, toDate: q.toDate };
  return useQuery({
    queryKey: clinicReportKeys.paymentLines(params),
    queryFn: () =>
      api.get<PaymentLineDto[]>(`${BASE}/payment-lines`, { params }).then((r) => r.data),
  });
}

export function useRefundLines(q: RangeQuery) {
  const params: ClinicReportQuery = { fromDate: q.fromDate, toDate: q.toDate };
  return useQuery({
    queryKey: clinicReportKeys.refundLines(params),
    queryFn: () =>
      api.get<RefundLineDto[]>(`${BASE}/refund-lines`, { params }).then((r) => r.data),
  });
}

export function useDebtLines(q: RangeQuery) {
  const params: ClinicReportQuery = { fromDate: q.fromDate, toDate: q.toDate };
  return useQuery({
    queryKey: clinicReportKeys.debtLines(params),
    queryFn: () =>
      api.get<DebtLineDto[]>(`${BASE}/debt-lines`, { params }).then((r) => r.data),
  });
}

export function usePrepaidLines(q: RangeQuery) {
  const params: ClinicReportQuery = { fromDate: q.fromDate, toDate: q.toDate };
  return useQuery({
    queryKey: clinicReportKeys.prepaidLines(params),
    queryFn: () =>
      api.get<PrepaidLineDto[]>(`${BASE}/prepaid-lines`, { params }).then((r) => r.data),
  });
}

export function useSalesSummary(q: RangeQuery) {
  const params: ClinicReportQuery = { fromDate: q.fromDate, toDate: q.toDate };
  return useQuery({
    queryKey: clinicReportKeys.salesSummary(params),
    queryFn: () =>
      api.get<SalesSummaryDto>(`${BASE}/sales-summary`, { params }).then((r) => r.data),
  });
}

export function useOverviewStats(q: RangeQuery) {
  const params: ClinicReportQuery = { fromDate: q.fromDate, toDate: q.toDate };
  return useQuery({
    queryKey: clinicReportKeys.overviewStats(params),
    queryFn: () =>
      api.get<OverviewStatsDto>(`${BASE}/overview-stats`, { params }).then((r) => r.data),
  });
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
