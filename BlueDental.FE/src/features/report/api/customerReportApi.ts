import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/axios";
import { downloadFile } from "@/lib/download";
import { clinicReportKeys, type ClinicReportQuery, type RangeQuery } from "./clinicReportApi";

const BASE = "/v1/app/clinic-reports";

/** Mirrors BlueDental.Marketing.TicketChannel (the report cannot import the marketing feature). */
export const REPORT_TICKET_CHANNEL = { 1: "Manual", 2: "File", 3: "Website" } as const;
export type ReportTicketChannel = keyof typeof REPORT_TICKET_CHANNEL;

/** Mirrors BlueDental.CustomerCare.CareType — the 9 tabs of /cskh-grouping. */
export const REPORT_CARE_TYPE = {
  1: "AfterTreatment",
  2: "Birthday",
  3: "AppointmentReminder",
  4: "Periodic",
  5: "Special",
  7: "NoService",
  8: "MissedAppointment",
  9: "CancelledAppointment",
  10: "Complaint",
} as const;
export type ReportCareType = keyof typeof REPORT_CARE_TYPE;

export interface TelesaleBreakdownRowDto {
  id: string | null;
  name: string | null;
  total: number;
  new: number;
  inCare: number;
  booked: number;
  arrived: number;
  notPotential: number;
  overdue: number;
}

export interface TelesaleChannelRowDto extends TelesaleBreakdownRowDto {
  channel: ReportTicketChannel;
}

export interface TelesaleCustomerTypeRowDto extends TelesaleBreakdownRowDto {
  isReturningCustomer: boolean;
}

export interface TelesaleFileRowDto extends TelesaleBreakdownRowDto {
  importedAt: string;
  rowCount: number;
  createdCount: number;
  reoccurredCount: number;
}

export interface TelesaleDayPointDto {
  /** Clinic day, YYYY-MM-DD. */
  date: string;
  total: number;
  booked: number;
  arrived: number;
}

export interface TelesaleReportDto {
  summary: TelesaleBreakdownRowDto;
  byDay: TelesaleDayPointDto[];
  bySource: TelesaleBreakdownRowDto[];
  byChannel: TelesaleChannelRowDto[];
  byCustomerType: TelesaleCustomerTypeRowDto[];
  byFile: TelesaleFileRowDto[];
  byAssignee: TelesaleBreakdownRowDto[];
}

export interface CareReportRowDto {
  total: number;
  new: number;
  contacted: number;
  succeeded: number;
  failed: number;
  cancelled: number;
  zaloSent: number;
}

export interface CareTypeReportRowDto extends CareReportRowDto {
  type: ReportCareType;
}

export interface CareStaffReportRowDto extends CareReportRowDto {
  staffId: string | null;
  name: string | null;
}

export interface CareOutcomeCountsDto {
  notRated: number;
  good: number;
  fair: number;
  normal: number;
  complaint: number;
}

export interface CareReportDto {
  summary: CareReportRowDto;
  byType: CareTypeReportRowDto[];
  byOutcome: CareOutcomeCountsDto;
  byStaff: CareStaffReportRowDto[];
}

const customerReportKeys = {
  telesale: (params: ClinicReportQuery) => [...clinicReportKeys.all, "telesale", params] as const,
  care: (params: ClinicReportQuery) => [...clinicReportKeys.all, "customer-care", params] as const,
};

function toParams(q: RangeQuery): ClinicReportQuery {
  return { fromDate: q.fromDate, toDate: q.toDate };
}

export function useTelesaleReport(q: RangeQuery) {
  const params = toParams(q);
  return useQuery({
    queryKey: customerReportKeys.telesale(params),
    queryFn: () => api.get<TelesaleReportDto>(`${BASE}/telesale`, { params }).then((r) => r.data),
  });
}

export function useCareReport(q: RangeQuery) {
  const params = toParams(q);
  return useQuery({
    queryKey: customerReportKeys.care(params),
    queryFn: () => api.get<CareReportDto>(`${BASE}/customer-care`, { params }).then((r) => r.data),
  });
}

/** "Xuất Excel" of the Telesale tab; the server builds the sheet, errors toast globally. */
export function useExportTelesaleReport() {
  return useMutation({
    mutationFn: (q: RangeQuery) =>
      downloadFile(`${BASE}/telesale/excel`, "bao-cao-telesale.xlsx", { ...toParams(q) }),
  });
}

/** "Xuất Excel" of the CSKH tab. */
export function useExportCareReport() {
  return useMutation({
    mutationFn: (q: RangeQuery) =>
      downloadFile(`${BASE}/customer-care/excel`, "bao-cao-cskh.xlsx", { ...toParams(q) }),
  });
}
