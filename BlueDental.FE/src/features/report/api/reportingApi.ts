import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/axios";

export interface RevenueReportDto {
  date: string;
  totalRevenue: number;
  newPatients: number;
  appointments: number;
}

export interface ReportSummaryDto {
  totalRevenue: number;
  totalPatients: number;
  totalAppointments: number;
  avgRevenuePerPatient: number;
}

export interface ExpenseLineItemDto {
  id: string;
  date: string;
  patientName: string;
  counselorName?: string;
  doctorName?: string;
  serviceName?: string;
  quantity: number;
  totalAmount: number;
  paidAmount: number;
}

export interface ExpenseReportResultDto {
  items: ExpenseLineItemDto[];
  totalCount: number;
  grandTotalAmount: number;
  grandPaidAmount: number;
}

interface ReportQueryParams {
  startDate: string;
  endDate: string;
  doctorId?: string;
}

const reportingApi = {
  summary: (params: ReportQueryParams): Promise<ReportSummaryDto> =>
    api.get("/v1/app/reports/appointments/summary", { params }).then((r) => r.data),

  revenue: (params: ReportQueryParams & { groupBy?: string }): Promise<RevenueReportDto[]> =>
    api.get("/v1/app/reports/billing/revenue", { params }).then((r) => r.data),
};

export function useReportSummary(params: ReportQueryParams) {
  return useQuery({
    queryKey: ["report-summary", params],
    queryFn: () => reportingApi.summary(params),
    enabled: Boolean(params.startDate && params.endDate),
  });
}

export function useRevenueReport(params: ReportQueryParams & { groupBy?: string }) {
  return useQuery({
    queryKey: ["report-revenue", params],
    queryFn: () => reportingApi.revenue(params),
    enabled: Boolean(params.startDate && params.endDate),
  });
}

export function useExpenseReport(params: ReportQueryParams) {
  return useQuery({
    queryKey: ["report-expense", params],
    queryFn: (): Promise<ExpenseReportResultDto> =>
      api
        .get("/v1/app/reports/expense/line-items", {
          params: { from: params.startDate, to: params.endDate, doctorId: params.doctorId },
        })
        .then((r) => r.data),
    enabled: Boolean(params.startDate && params.endDate),
  });
}
