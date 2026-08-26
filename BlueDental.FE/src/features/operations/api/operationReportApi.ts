import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/axios";
import { useBranchFilter } from "@/lib/clinicBranch";

/**
 * The Vận hành report tabs.
 *
 * Read-only, one endpoint per screen, all sharing the same window parameters.
 * Everything here is a plain projection of what the server returns — no
 * adapters, because these rows exist only to be shown in one table each.
 */

/** Matches the server's `WorkLogAction`. */
export type WorkLogAction =
  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11;

/** Matches the server's `SalesCategory`. */
export const SALES_CATEGORY = {
  total: 1,
  completed: 2,
  ownQuota: 3,
} as const;

export type SalesCategory = (typeof SALES_CATEGORY)[keyof typeof SALES_CATEGORY];

export interface ReportWindow {
  periodCode: number;
  anchorIso: string;
  skipCount: number;
  maxResultCount: number;
  filter?: string;
}

interface Paged<T> {
  totalCount: number;
  items: T[];
}

export interface WorkLogRow {
  /** One patient on one day — the block this row is drawn inside. */
  visitKey: string;
  visitDate: string;
  arrivedAt?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  occurredAt: string;
  patientCode: string;
  patientName: string;
  staffName: string;
  action: WorkLogAction;
  subject: string;
  note?: string | null;
  amount: number;
}

export interface UntreatedDiagnosisRow {
  diagnosedAt: string;
  patientCode: string;
  patientName: string;
  staffName: string;
  teeth: string;
  diagnosisName: string;
  note?: string | null;
}

export interface ConsultantSummaryRow {
  staffId: string;
  staffName: string;
  newPatientConsultations: number;
  returningPatientConsultations: number;
  newPatientRevenue: number;
  returningPatientRevenue: number;
  totalConsultations: number;
  totalRevenue: number;
}

export interface InvoiceReportRow {
  createdAt: string;
  invoiceNumber: string;
  patientName: string;
  unitName: string;
  paymentMethod: string;
  issueStatus: string;
  status: string;
  subTotal: number;
  taxAmount: number;
  totalAmount: number;
  supplier?: string | null;
}

export interface ServiceLineRow {
  id: string;
  occurredAt: string;
  patientCode: string;
  patientName: string;
  patientCreatedAt: string;
  occupation?: string | null;
  branchName: string;
  serviceName: string;
  detailName?: string | null;
  serviceGroupName: string;
  classification: SalesCategory;
  syncStatus: string;
  invoiceStatus: string;
  diagnosingDentistName?: string | null;
  secondDiagnosisName?: string | null;
  consultantName?: string | null;
  secondConsultantName?: string | null;
  treatingDentistName?: string | null;
  supportingDentistName?: string | null;
  assistantName?: string | null;
  teeth: string;
  serviceNote?: string | null;
  treatmentContent?: string | null;
  price: number;
  quantity: number;
  discountAmount: number;
  doctorAmount: number;
  stageName?: string | null;
  taxKind?: string | null;
  taxPercent?: number | null;
}

export interface ServiceCompletionStats {
  actualCollected: number;
  totalRevenue: number;
  revenueChangePercent: number | null;
  advanceRevenue: number;
  completedServices: number;
  onScheduePercent: number;
  ownQuotaServices: number;
}

export interface SalesAccessStats {
  totalSales: number;
  completedServices: number;
  ownQuotaServices: number;
}

type WorkLogResult = Paged<WorkLogRow> & { plannedSales: number };
type ServiceCompletionResult = Paged<ServiceLineRow> & { stats: ServiceCompletionStats };
type SalesAccessResult = Paged<ServiceLineRow> & { stats: SalesAccessStats };

const BASE = "/v1/app/operations/reports";

function params(window: ReportWindow, clinicBranchId?: string) {
  return {
    ClinicBranchId: clinicBranchId,
    Period: window.periodCode,
    Anchor: window.anchorIso,
    Filter: window.filter,
    SkipCount: window.skipCount,
    MaxResultCount: window.maxResultCount,
  };
}

/**
 * One hook per report. They differ only in path and row type, so they are
 * built from a single factory rather than six near-identical copies.
 */
function reportQuery<TResult>(key: string, path: string) {
  return (window: ReportWindow, extra: Record<string, unknown> = {}, enabled = true) => {
    const clinicBranchId = useBranchFilter();

    return useQuery({
      queryKey: ["operation-report", key, clinicBranchId, window, extra],
      queryFn: async (): Promise<TResult> => {
        const response = await api.get(`${BASE}/${path}`, {
          params: { ...params(window, clinicBranchId), ...extra },
        });
        return response.data;
      },
      enabled,
    });
  };
}

export const useWorkLog = reportQuery<WorkLogResult>("work-log", "work-log");

export const useUntreatedDiagnoses =
  reportQuery<Paged<UntreatedDiagnosisRow>>("untreated", "untreated-diagnoses");

export const useConsultantSummary =
  reportQuery<Paged<ConsultantSummaryRow>>("consultant", "consultant-summary");

export const useInvoiceReport = reportQuery<Paged<InvoiceReportRow>>("invoices", "invoices");

export const useServiceCompletion =
  reportQuery<ServiceCompletionResult>("service-completion", "service-completion");

export const useSalesAccess = reportQuery<SalesAccessResult>("sales-access", "sales-access");
