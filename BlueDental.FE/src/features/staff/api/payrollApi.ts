import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/axios";
import { useCurrentBranchId } from "@/lib/clinicBranch";
import { downloadFile } from "@/lib/download";

/**
 * Nhân viên → Bảng lương (Cụm 11 mục 5–6). BlueDental-local
 * (docs/clone/pages/payroll.md). The server works every figure out — from
 * lương cơ bản, chấm công, công đoạn and chế tài — and keeps the draft / chốt
 * rules; the screen only shows them and sends the hand-entered parts.
 */

const BASE = "/v1/app/payroll";

/** Mirrors BlueDental.Staff.PayrollStatus. */
export const PAYROLL_STATUS = { Draft: 1, Finalized: 2 } as const;
export type PayrollStatus = (typeof PAYROLL_STATUS)[keyof typeof PAYROLL_STATUS];

export interface PayrollPeriodSummary {
  id: string;
  clinicBranchId: string;
  year: number;
  month: number;
  status: PayrollStatus;
  staffCount: number;
  netTotal: number;
  creationTime: string;
  finalizedAt?: string | null;
}

export interface PayrollEntry {
  staffId: string;
  staffName: string;
  baseSalary: number;
  allowance: number;
  workedDays: number;
  leaveDays: number;
  workDaysOverride: number | null;
  payableWorkDays: number;
  overtimeMinutes: number;
  salaryByWorkDays: number;
  overtimePay: number;
  commissionAmount: number;
  bonus: number;
  penaltyAmount: number;
  otherDeduction: number;
  grossSalary: number;
  netSalary: number;
  note: string | null;
}

export interface PayrollPeriod extends PayrollPeriodSummary {
  standardWorkDays: number;
  overtimeRate: number;
  finalizedByName?: string | null;
  entries: PayrollEntry[];
}

export interface PayrollEntryInput {
  workDaysOverride: number | null;
  bonus: number;
  otherDeduction: number;
  note: string | null;
}

export interface PayrollTermsInput {
  standardWorkDays: number;
  overtimeRate: number;
}

export interface StaffCompensation {
  staffId: string;
  staffName: string;
  userName?: string | null;
  baseSalary: number;
  allowance: number;
}

export const payrollKeys = {
  all: ["payroll"] as const,
  periods: (branchId: string) => [...payrollKeys.all, "periods", branchId] as const,
  period: (id: string) => [...payrollKeys.all, "period", id] as const,
  compensations: (branchId: string) => [...payrollKeys.all, "compensations", branchId] as const,
};

export function usePayrollPeriods() {
  const branchId = useCurrentBranchId();
  return useQuery({
    queryKey: payrollKeys.periods(branchId),
    queryFn: async () =>
      (await api.get<{ items: PayrollPeriodSummary[] }>(`${BASE}/periods`, { params: { ClinicBranchId: branchId } })).data
        .items,
  });
}

export function usePayrollPeriod(id: string | undefined) {
  return useQuery({
    queryKey: payrollKeys.period(id ?? "none"),
    queryFn: async () => (await api.get<PayrollPeriod>(`${BASE}/periods/${id}`)).data,
    enabled: Boolean(id),
  });
}

export function useStaffCompensations(enabled: boolean) {
  const branchId = useCurrentBranchId();
  return useQuery({
    queryKey: payrollKeys.compensations(branchId),
    queryFn: async () =>
      (await api.get<{ items: StaffCompensation[] }>(`${BASE}/compensations`, { params: { ClinicBranchId: branchId } }))
        .data.items,
    enabled,
  });
}

export function usePayrollCommands() {
  const queryClient = useQueryClient();
  const branchId = useCurrentBranchId();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: payrollKeys.all });
  const create = useMutation({
    mutationFn: ({ year, month }: { year: number; month: number }) =>
      api.post<PayrollPeriod>(`${BASE}/periods`, { clinicBranchId: branchId, year, month }).then((r) => r.data),
    onSuccess: invalidate,
  });
  const recalculate = useMutation({
    mutationFn: (id: string) => api.post<PayrollPeriod>(`${BASE}/periods/${id}/recalculate`).then((r) => r.data),
    onSuccess: invalidate,
  });
  const updateTerms = useMutation({
    mutationFn: ({ id, input }: { id: string; input: PayrollTermsInput }) =>
      api.put<PayrollPeriod>(`${BASE}/periods/${id}/terms`, input).then((r) => r.data),
    onSuccess: invalidate,
  });
  const updateEntry = useMutation({
    mutationFn: ({ id, staffId, input }: { id: string; staffId: string; input: PayrollEntryInput }) =>
      api.put<PayrollPeriod>(`${BASE}/periods/${id}/entries/${staffId}`, input).then((r) => r.data),
    onSuccess: invalidate,
  });
  const finalize = useMutation({
    mutationFn: (id: string) => api.post<PayrollPeriod>(`${BASE}/periods/${id}/finalize`).then((r) => r.data),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`${BASE}/periods/${id}`).then(() => undefined),
    onSuccess: invalidate,
  });
  const setCompensation = useMutation({
    mutationFn: ({ staffId, baseSalary, allowance }: { staffId: string; baseSalary: number; allowance: number }) =>
      api.put<StaffCompensation>(`${BASE}/compensations/${staffId}`, { baseSalary, allowance }).then((r) => r.data),
    onSuccess: invalidate,
  });

  return { create, recalculate, updateTerms, updateEntry, finalize, remove, setCompensation };
}

export function exportPayroll(id: string): Promise<void> {
  return downloadFile(`${BASE}/periods/${id}/excel`, "bang-luong.xlsx");
}
