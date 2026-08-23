import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/axios";

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
  totalOutstandingDebt: number;
  totalPrepaid: number;
  totalActualReceived: number;
  patientVisits: number;
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

export interface BusinessResultDto {
  totalRevenue: number;
  treatmentIncome: number;
  otherIncome: number;
  treatmentRefund: number;
  expense: number;
  result: number;
}

export interface ClinicReportQuery {
  clinicBranchId?: string;
  fromDate?: string;
  toDate?: string;
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
