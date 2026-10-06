import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/axios";
import { useBranchFilter, useCurrentBranchId } from "@/lib/clinicBranch";
import type { PagedResult } from "@/types";

/**
 * Nhân viên → Chế tài. BlueDental-local (docs/clone/pages/staff-penalty.md):
 * the reference has no such screen. Everything is filtered and paged on the
 * server; the workflow rules (Nháp → Đã duyệt / Đã huỷ) are the server's too.
 */

const PENALTY_BASE = "/v1/app/staff-penalties";
const TYPE_BASE = "/v1/app/staff-violation-types";

/** Mirrors BlueDental.Staff.StaffPenaltyStatus. */
export const PENALTY_STATUS = { Draft: 1, Approved: 2, Cancelled: 3 } as const;
export type PenaltyStatus = (typeof PENALTY_STATUS)[keyof typeof PENALTY_STATUS];

/** Mirrors BlueDental.Staff.StaffPenaltyAction. Only Fine carries an amount. */
export const PENALTY_ACTION = { Reminder: 1, Warning: 2, Fine: 3, Other: 4 } as const;
export type PenaltyAction = (typeof PENALTY_ACTION)[keyof typeof PENALTY_ACTION];

export interface StaffPenaltyDto {
  id: string;
  clinicBranchId: string;
  staffId: string;
  staffName?: string | null;
  violationTypeId?: string | null;
  violationTypeName?: string | null;
  /** "YYYY-MM-DD". */
  violationDate: string;
  action: PenaltyAction;
  fineAmount: number;
  description?: string | null;
  status: PenaltyStatus;
  approverName?: string | null;
  approvedAt?: string | null;
  cancelledAt?: string | null;
  cancelReason?: string | null;
  creatorName?: string | null;
  creationTime: string;
}

export interface StaffPenaltyPage extends PagedResult<StaffPenaltyDto> {
  /** Σ of the approved fines matching the filter. */
  approvedFineTotal: number;
}

export interface StaffPenaltyInput {
  staffId: string;
  violationTypeId?: string | null;
  violationDate: string;
  action: PenaltyAction;
  fineAmount: number;
  description?: string | null;
}

export interface StaffPenaltyQuery {
  filter?: string;
  status?: PenaltyStatus;
  fromDate?: string;
  toDate?: string;
  skipCount: number;
  maxResultCount: number;
}

export interface StaffViolationTypeDto {
  id: string;
  name: string;
  defaultFineAmount: number;
}

export interface StaffViolationTypeInput {
  name: string;
  defaultFineAmount: number;
}

export interface BranchStaffOption {
  value: string;
  label: string;
}

export const staffPenaltyKeys = {
  all: ["staff-penalties"] as const,
  list: (branchId: string | undefined, query: StaffPenaltyQuery) =>
    [...staffPenaltyKeys.all, "list", branchId ?? "all", query] as const,
  types: (branchId: string | undefined) => [...staffPenaltyKeys.all, "types", branchId ?? "all"] as const,
  branchStaff: (branchId: string) => [...staffPenaltyKeys.all, "branch-staff", branchId] as const,
};

export function useStaffPenaltyList(query: StaffPenaltyQuery) {
  const clinicBranchId = useBranchFilter();

  return useQuery({
    queryKey: staffPenaltyKeys.list(clinicBranchId, query),
    queryFn: async () =>
      (
        await api.get<StaffPenaltyPage>(PENALTY_BASE, {
          params: {
            ClinicBranchId: clinicBranchId,
            Filter: query.filter?.trim() || undefined,
            Status: query.status,
            FromDate: query.fromDate,
            ToDate: query.toDate,
            SkipCount: query.skipCount,
            MaxResultCount: query.maxResultCount,
          },
        })
      ).data,
    placeholderData: keepPreviousData,
  });
}

export function useStaffViolationTypes() {
  const clinicBranchId = useBranchFilter();

  return useQuery({
    queryKey: staffPenaltyKeys.types(clinicBranchId),
    queryFn: async () =>
      (
        await api.get<PagedResult<StaffViolationTypeDto>>(TYPE_BASE, {
          params: { ClinicBranchId: clinicBranchId, MaxResultCount: 1000 },
        })
      ).data.items,
  });
}

interface StaffRow {
  id: string;
  name: string | null;
  surname: string | null;
  userName: string;
}

/** Staff working at the branch a new record is filed under — the only ones the server accepts. */
export function useBranchStaffOptions() {
  const branchId = useCurrentBranchId();

  return useQuery({
    queryKey: staffPenaltyKeys.branchStaff(branchId),
    queryFn: async (): Promise<BranchStaffOption[]> => {
      const response = await api.get<PagedResult<StaffRow>>("/v1/app/staff", {
        params: { BranchId: branchId, MaxResultCount: 1000 },
      });
      return response.data.items.map((row) => ({
        value: row.id,
        label: [row.surname, row.name].filter(Boolean).join(" ").trim() || row.userName,
      }));
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useStaffPenaltyCommands() {
  const queryClient = useQueryClient();
  const clinicBranchId = useCurrentBranchId();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: staffPenaltyKeys.all });

  const create = useMutation({
    mutationFn: (input: StaffPenaltyInput) =>
      api.post<StaffPenaltyDto>(PENALTY_BASE, { ...input, clinicBranchId }).then((r) => r.data),
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: ({ id, input }: { id: string; input: StaffPenaltyInput }) =>
      api.put<StaffPenaltyDto>(`${PENALTY_BASE}/${id}`, input).then((r) => r.data),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`${PENALTY_BASE}/${id}`).then(() => undefined),
    onSuccess: invalidate,
  });

  const approve = useMutation({
    mutationFn: (id: string) => api.post<StaffPenaltyDto>(`${PENALTY_BASE}/${id}/approve`).then((r) => r.data),
    onSuccess: invalidate,
  });

  const cancel = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api.post<StaffPenaltyDto>(`${PENALTY_BASE}/${id}/cancel`, { reason }).then((r) => r.data),
    onSuccess: invalidate,
  });

  return { create, update, remove, approve, cancel };
}

export function useStaffViolationTypeCommands() {
  const queryClient = useQueryClient();
  const clinicBranchId = useCurrentBranchId();
  // The penalty rows show the type's name, so both lists refresh together.
  const invalidate = () => queryClient.invalidateQueries({ queryKey: staffPenaltyKeys.all });

  const create = useMutation({
    mutationFn: (input: StaffViolationTypeInput) =>
      api.post<StaffViolationTypeDto>(TYPE_BASE, { ...input, clinicBranchId }).then((r) => r.data),
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: ({ id, input }: { id: string; input: StaffViolationTypeInput }) =>
      api.put<StaffViolationTypeDto>(`${TYPE_BASE}/${id}`, input).then((r) => r.data),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`${TYPE_BASE}/${id}`).then(() => undefined),
    onSuccess: invalidate,
  });

  return { create, update, remove };
}
