import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/axios";
import { t } from "@/lib/i18n";
import type { PagedResult } from "@/types";

/** Matches BlueDental.CustomerCare.CareType — the CSKH tabs. */
export const CARE_TYPE = {
  AfterTreatment: 1,
  Birthday: 2,
  AppointmentReminder: 3,
  Periodic: 4,
  Special: 5,
} as const;
export type CareType = (typeof CARE_TYPE)[keyof typeof CARE_TYPE];

export const careTypeLabels = (): Record<CareType, string> => ({
  [CARE_TYPE.AfterTreatment]: t("Sau điều trị"),
  [CARE_TYPE.Birthday]: t("Chúc mừng sinh nhật"),
  [CARE_TYPE.AppointmentReminder]: t("Nhắc lịch hẹn"),
  [CARE_TYPE.Periodic]: t("CSKH định kì"),
  [CARE_TYPE.Special]: t("CSKH đặc biệt"),
});

/** Matches BlueDental.CustomerCare.CareStatus. */
export const CARE_STATUS = {
  New: 1,
  Contacted: 2,
  Succeeded: 3,
  Failed: 4,
  Cancelled: 5,
} as const;
export type CareStatus = (typeof CARE_STATUS)[keyof typeof CARE_STATUS];

export const careStatusConfig = (): Record<CareStatus, { label: string; color: string }> => ({
  [CARE_STATUS.New]: { label: t("Chưa chăm sóc"), color: "default" },
  [CARE_STATUS.Contacted]: { label: t("Đã liên hệ"), color: "blue" },
  [CARE_STATUS.Succeeded]: { label: t("Thành công"), color: "green" },
  [CARE_STATUS.Failed]: { label: t("Thất bại"), color: "red" },
  [CARE_STATUS.Cancelled]: { label: t("Đã huỷ"), color: "default" },
});

/** Matches BlueDental.CustomerCare.CareOutcome — the "Đánh giá" column. */
export const CARE_OUTCOME = { NotRated: 0, Good: 1, Fair: 2, Normal: 3, Complaint: 4 } as const;
export type CareOutcome = (typeof CARE_OUTCOME)[keyof typeof CARE_OUTCOME];

export const careOutcomeLabels = (): Record<CareOutcome, string> => ({
  [CARE_OUTCOME.NotRated]: t("Chưa đánh giá"),
  [CARE_OUTCOME.Good]: t("Tốt"),
  [CARE_OUTCOME.Fair]: t("Khá"),
  [CARE_OUTCOME.Normal]: t("Bình thường"),
  [CARE_OUTCOME.Complaint]: t("Khiếu nại"),
});

export interface CareRecordDto {
  id: string;
  patientId: string;
  branchId: string;
  assignedStaffId: string | null;
  careStaffId: string | null;
  type: CareType;
  status: CareStatus;
  outcome: CareOutcome;
  subject: string;
  description: string | null;
  resolution: string | null;
  careServiceId: string | null;
  dueAt: string | null;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  completedAt: string | null;
  zaloSentAt: string | null;
  stageIds: string[];
  patientName: string | null;
  patientPhone: string | null;
  assignedStaffName: string | null;
  careStaffName: string | null;
  careServiceName: string | null;
  creationTime: string;
}

export interface CareStatsDto {
  totalPatients: number;
  succeeded: number;
  failed: number;
  notCaredYet: number;
  zaloSent: number;
  good: number;
  fair: number;
  normal: number;
  complaint: number;
}

export interface CareListInput {
  branchId?: string;
  patientId?: string;
  type?: CareType;
  status?: CareStatus;
  fromDate?: string;
  toDate?: string;
  filter?: string;
  skipCount?: number;
  maxResultCount?: number;
}

export interface CreateCareRecordInput {
  patientId: string;
  branchId: string;
  type: CareType;
  subject: string;
  description?: string;
  assignedStaffId?: string;
  careServiceId?: string;
  dueAt?: string;
}

const BASE = "/v1/app/care-records";

const careApi = {
  list: (params: CareListInput): Promise<PagedResult<CareRecordDto>> =>
    api.get<PagedResult<CareRecordDto>>(BASE, { params }).then((r) => r.data),

  stats: (params: CareListInput): Promise<CareStatsDto> =>
    api.get<CareStatsDto>(`${BASE}/stats`, { params }).then((r) => r.data),

  create: (input: CreateCareRecordInput): Promise<CareRecordDto> =>
    api.post<CareRecordDto>(BASE, input).then((r) => r.data),

  contacted: (id: string): Promise<CareRecordDto> =>
    api.post<CareRecordDto>(`${BASE}/${id}/contacted`).then((r) => r.data),

  succeed: (id: string, outcome: CareOutcome, resolution?: string): Promise<CareRecordDto> =>
    api.post<CareRecordDto>(`${BASE}/${id}/succeed`, { outcome, resolution }).then((r) => r.data),

  fail: (id: string, reason: string): Promise<CareRecordDto> =>
    api.post<CareRecordDto>(`${BASE}/${id}/fail`, { reason }).then((r) => r.data),

  zaloSent: (id: string): Promise<CareRecordDto> =>
    api.post<CareRecordDto>(`${BASE}/${id}/zalo-sent`).then((r) => r.data),
};

export const careKeys = {
  all: ["care-records"] as const,
  list: (params: CareListInput) => [...careKeys.all, "list", params] as const,
  stats: (params: CareListInput) => [...careKeys.all, "stats", params] as const,
};

export function useCareRecords(params: CareListInput) {
  return useQuery({
    queryKey: careKeys.list(params),
    queryFn: () => careApi.list(params),
  });
}

export function useCareStats(params: CareListInput) {
  return useQuery({
    queryKey: careKeys.stats(params),
    queryFn: () => careApi.stats(params),
  });
}

/** Any care write moves both the table and the counters, so invalidate the tree. */
function useCareMutation<TVariables, TData>(fn: (variables: TVariables) => Promise<TData>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: careKeys.all });
    },
  });
}

export function useCreateCareRecord() {
  return useCareMutation((input: CreateCareRecordInput) => careApi.create(input));
}

export function useMarkCareContacted() {
  return useCareMutation((id: string) => careApi.contacted(id));
}

export function useSucceedCare() {
  return useCareMutation(
    ({ id, outcome, resolution }: { id: string; outcome: CareOutcome; resolution?: string }) =>
      careApi.succeed(id, outcome, resolution),
  );
}

export function useFailCare() {
  return useCareMutation(({ id, reason }: { id: string; reason: string }) =>
    careApi.fail(id, reason),
  );
}

export function useMarkZaloSent() {
  return useCareMutation((id: string) => careApi.zaloSent(id));
}
