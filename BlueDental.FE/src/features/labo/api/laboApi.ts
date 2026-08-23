import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/axios";
import type { PagedResult } from "@/types";

// ── Types ─────────────────────────────────────────────────────────────────

/** Matches BlueDental.Labo.LaboStatus on the server. */
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
  [LABO_STATUS.Draft]:      { label: "Nháp",         color: "default" },
  [LABO_STATUS.Sent]:       { label: "Đã gửi",       color: "blue"    },
  [LABO_STATUS.InProgress]: { label: "Đang làm",     color: "orange"  },
  [LABO_STATUS.Received]:   { label: "Đã nhận hàng", color: "green"   },
  [LABO_STATUS.Completed]:  { label: "Hoàn tất",     color: "green"   },
  [LABO_STATUS.Rejected]:   { label: "Từ chối",      color: "red"     },
};

export interface LaboOrderDto {
  id: string;
  orderCode: string;
  patientId: string;
  patientName?: string;
  dentistId?: string;
  dentistName?: string;
  labProviderName: string;
  status: LaboStatus;
  toothNumbers?: string;
  workDescription?: string;
  notes?: string;
  dueDate?: string;
  sentAt?: string;
  receivedAt?: string;
  estimatedCost: number;
  rejectionReason?: string;
  creationTime: string;
}

export interface CreateLaboOrderDto {
  patientId: string;
  dentistId?: string;
  labProviderName: string;
  toothNumbers?: string;
  workDescription?: string;
  notes?: string;
  dueDate?: string;
  estimatedCost: number;
}

export interface UpdateLaboOrderDto {
  labProviderName?: string;
  toothNumbers?: string;
  workDescription?: string;
  notes?: string;
  dueDate?: string;
  estimatedCost?: number;
}

// ── API ───────────────────────────────────────────────────────────────────

export const laboApi = {
  list: (params: {
    patientId?: string;
    status?: LaboStatus;
    skipCount?: number;
    maxResultCount?: number;
  }): Promise<PagedResult<LaboOrderDto>> =>
    api.get("/v1/app/labo-orders", { params }).then((r) => r.data),

  get: (id: string): Promise<LaboOrderDto> =>
    api.get(`/v1/app/labo-orders/${id}`).then((r) => r.data),

  create: (data: CreateLaboOrderDto): Promise<LaboOrderDto> =>
    api.post("/v1/app/labo-orders", data).then((r) => r.data),

  update: (id: string, data: UpdateLaboOrderDto): Promise<LaboOrderDto> =>
    api.put(`/v1/app/labo-orders/${id}`, data).then((r) => r.data),

  delete: (id: string): Promise<void> =>
    api.delete(`/v1/app/labo-orders/${id}`).then((r) => r.data),

  markReceived: (id: string): Promise<LaboOrderDto> =>
    api.post(`/v1/app/labo-orders/${id}/receive`).then((r) => r.data),
};

// ── Hooks ─────────────────────────────────────────────────────────────────

export function usePatientLaboOrders(patientId: string) {
  return useQuery({
    queryKey: ["labo-orders", { patientId }],
    queryFn: () => laboApi.list({ patientId, maxResultCount: 50 }),
    enabled: Boolean(patientId),
    select: (d) => d.items,
  });
}

export function useLaboOrderList(params: {
  patientId?: string;
  status?: LaboStatus;
  skipCount?: number;
  maxResultCount?: number;
} = {}) {
  return useQuery({
    queryKey: ["labo-orders", params],
    queryFn: () => laboApi.list(params),
  });
}

export function useCreateLaboOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateLaboOrderDto) => laboApi.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["labo-orders"] }),
  });
}

export function useUpdateLaboOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateLaboOrderDto }) =>
      laboApi.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["labo-orders"] }),
  });
}

export function useDeleteLaboOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => laboApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["labo-orders"] }),
  });
}
