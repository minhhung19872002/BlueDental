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

const reportingApi = {
  summary: (params: { startDate: string; endDate: string }): Promise<ReportSummaryDto> =>
    api.get("/v1/app/reports/appointments/summary", { params }).then((r) => r.data),

  revenue: (params: { startDate: string; endDate: string; groupBy?: string }): Promise<RevenueReportDto[]> =>
    api.get("/v1/app/reports/billing/revenue", { params }).then((r) => r.data),
};

export function useReportSummary(params: { startDate: string; endDate: string }) {
  return useQuery({
    queryKey: ["report-summary", params],
    queryFn: () => reportingApi.summary(params),
    enabled: Boolean(params.startDate && params.endDate),
  });
}

export function useRevenueReport(params: { startDate: string; endDate: string; groupBy?: string }) {
  return useQuery({
    queryKey: ["report-revenue", params],
    queryFn: () => reportingApi.revenue(params),
    enabled: Boolean(params.startDate && params.endDate),
  });
}
