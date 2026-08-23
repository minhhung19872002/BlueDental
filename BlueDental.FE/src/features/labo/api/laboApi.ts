import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/axios";
import type { PagedResult } from "@/types";

/** Matches BlueDental.Labo.LaboStatus. */
export const LABO_STATUS = {
  Draft: 1,
  Sent: 2,
  InProgress: 3,
  Received: 4,
  Completed: 5,
  Rejected: 6,
} as const;
export type LaboStatus = (typeof LABO_STATUS)[keyof typeof LABO_STATUS];

export const LABO_STATUS_CONFIG: Record<LaboStatus, { label: string; color: string }> = {
  [LABO_STATUS.Draft]: { label: "Nháp", color: "default" },
  [LABO_STATUS.Sent]: { label: "Đã gửi", color: "blue" },
  [LABO_STATUS.InProgress]: { label: "Đang làm", color: "processing" },
  [LABO_STATUS.Received]: { label: "Đã nhận hàng", color: "green" },
  [LABO_STATUS.Completed]: { label: "Hoàn tất", color: "green" },
  [LABO_STATUS.Rejected]: { label: "Từ chối", color: "red" },
};

/** Matches BlueDental.Labo.LaboOrderKind — the patient-tab counters. */
export const LABO_KIND = { New: 1, ContinueStage: 2, Guarantee: 3 } as const;
export type LaboOrderKind = (typeof LABO_KIND)[keyof typeof LABO_KIND];

export const LABO_KIND_LABELS: Record<LaboOrderKind, string> = {
  [LABO_KIND.New]: "Đơn hàng mới",
  [LABO_KIND.ContinueStage]: "Tiếp tục công đoạn",
  [LABO_KIND.Guarantee]: "Bảo hành",
};

/** Matches BlueDental.Labo.LaboSampleFilter — the chips above the table. */
export const LABO_FILTER = { All: 0, AwaitingReturn: 1, Overdue: 2, Returned: 3 } as const;
export type LaboSampleFilter = (typeof LABO_FILTER)[keyof typeof LABO_FILTER];

export const LABO_FILTER_LABELS: Record<LaboSampleFilter, string> = {
  [LABO_FILTER.All]: "Tất Cả Mẫu",
  [LABO_FILTER.AwaitingReturn]: "Mẫu Chưa Nhận",
  [LABO_FILTER.Overdue]: "Mẫu Giao Trễ",
  [LABO_FILTER.Returned]: "Mẫu Đã Nhận Hàng",
};

export interface LaboOrderDto {
  id: string;
  orderCode: string;
  patientId: string;
  branchId: string;
  dentistId: string | null;
  labProviderName: string;
  status: LaboStatus;
  toothNumbers: string | null;
  workDescription: string | null;
  notes: string | null;
  dueDate: string | null;
  sentAt: string | null;
  receivedAt: string | null;
  estimatedCost: number;
  rejectionReason: string | null;
  kind: LaboOrderKind;
  supplierId: string | null;
  materialId: string | null;
  attachmentUrl: string | null;
  isOverdue: boolean;
  isAwaitingReturn: boolean;
  patientName: string | null;
  supplierName: string | null;
  materialName: string | null;
  dentistName: string | null;
  creationTime: string;
}

export interface LaboStatsDto {
  total: number;
  new: number;
  continueStage: number;
  guarantee: number;
  awaitingReturn: number;
  overdue: number;
  returned: number;
}

export interface LaboListInput {
  branchId?: string;
  patientId?: string;
  status?: LaboStatus;
  kind?: LaboOrderKind;
  sampleFilter?: LaboSampleFilter;
  filter?: string;
  skipCount?: number;
  maxResultCount?: number;
}

export interface CreateLaboOrderInput {
  patientId: string;
  branchId: string;
  dentistId?: string;
  labProviderName: string;
  toothNumbers?: string;
  workDescription?: string;
  dueDate?: string;
  estimatedCost: number;
  kind: LaboOrderKind;
  supplierId?: string;
  materialId?: string;
  biteId?: string;
  finishLineId?: string;
  rhythmId?: string;
}

const BASE = "/v1/app/labo-orders";

const laboApi = {
  list: (params: LaboListInput): Promise<PagedResult<LaboOrderDto>> =>
    api.get<PagedResult<LaboOrderDto>>(BASE, { params }).then((r) => r.data),

  stats: (params: LaboListInput): Promise<LaboStatsDto> =>
    api.get<LaboStatsDto>(`${BASE}/stats`, { params }).then((r) => r.data),

  create: (input: CreateLaboOrderInput): Promise<LaboOrderDto> =>
    api.post<LaboOrderDto>(BASE, input).then((r) => r.data),

  send: (id: string): Promise<void> => api.post(`${BASE}/${id}/send`).then(() => undefined),
  receive: (id: string): Promise<void> => api.post(`${BASE}/${id}/receive`).then(() => undefined),
  complete: (id: string): Promise<void> => api.post(`${BASE}/${id}/complete`).then(() => undefined),
};

export const laboKeys = {
  all: ["labo-orders"] as const,
  list: (params: LaboListInput) => [...laboKeys.all, "list", params] as const,
  stats: (params: LaboListInput) => [...laboKeys.all, "stats", params] as const,
};

export function useLaboOrders(params: LaboListInput) {
  return useQuery({
    queryKey: laboKeys.list(params),
    queryFn: () => laboApi.list(params),
  });
}

export function useLaboStats(params: LaboListInput) {
  return useQuery({
    queryKey: laboKeys.stats(params),
    queryFn: () => laboApi.stats(params),
  });
}

function useLaboMutation<TVariables, TData>(fn: (variables: TVariables) => Promise<TData>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: laboKeys.all });
    },
  });
}

export function useCreateLaboOrder() {
  return useLaboMutation((input: CreateLaboOrderInput) => laboApi.create(input));
}

export function useSendLaboOrder() {
  return useLaboMutation((id: string) => laboApi.send(id));
}

export function useReceiveLaboOrder() {
  return useLaboMutation((id: string) => laboApi.receive(id));
}

export function useCompleteLaboOrder() {
  return useLaboMutation((id: string) => laboApi.complete(id));
}
