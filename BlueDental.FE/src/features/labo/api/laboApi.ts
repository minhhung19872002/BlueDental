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

/**
 * Why the sample was sent — the counters on the patient's Labo tab.
 * Mirrors BlueDental.Labo.LaboOrderKind.
 */
export const LABO_ORDER_KIND = {
  New: 1,
  ContinueStage: 2,
  Guarantee: 3,
} as const;

export type LaboOrderKind = (typeof LABO_ORDER_KIND)[keyof typeof LABO_ORDER_KIND];

/**
 * "Tình trạng mẫu" — the pill under Ngày gửi on the patient's Labo tab, one
 * per kind. Same three tones as the status pills; amber is the counter's.
 */
export const LABO_KIND_CONFIG: Record<LaboOrderKind, { label: string; bg: string; color: string }> =
  {
    [LABO_ORDER_KIND.New]: { label: "Mẫu mới", bg: "#e2f4ee", color: "#0e9f6e" },
    [LABO_ORDER_KIND.ContinueStage]: {
      label: "Tiếp tục công đoạn",
      bg: "#fbf1de",
      color: "#d98b0f",
    },
    [LABO_ORDER_KIND.Guarantee]: { label: "Bảo hành", bg: "#fce9ea", color: "#E5484D" },
  };

/**
 * The three tones the reference paints a labo status in — a settled state is
 * green, a state that went wrong is red, and everything in flight is grey.
 * See docs/clone/pages/labo.md §2.5.
 */
export const LABO_STATUS_TONE = {
  red: { bg: "#fce9ea", color: "#E5484D" },
  green: { bg: "#e2f4ee", color: "#0e9f6e" },
  gray: { bg: "#f7f8fd", color: "#171c33" },
} as const;

export const LABO_STATUS_CONFIG: Record<LaboStatus, { label: string; bg: string; color: string }> =
  {
    [LABO_STATUS.Draft]: { label: "Đơn hàng mới", ...LABO_STATUS_TONE.green },
    [LABO_STATUS.Sent]: { label: "Đã gửi", ...LABO_STATUS_TONE.gray },
    [LABO_STATUS.InProgress]: { label: "Đang xử lý", ...LABO_STATUS_TONE.gray },
    [LABO_STATUS.Received]: { label: "Đã nhận", ...LABO_STATUS_TONE.green },
    [LABO_STATUS.Completed]: { label: "Hoàn thành", ...LABO_STATUS_TONE.green },
    [LABO_STATUS.Rejected]: { label: "Đã huỷ", ...LABO_STATUS_TONE.red },
  };

/**
 * The four filters above the Mẫu Labo table. The reference sends one status
 * code per tab; BlueDental sends the tab itself, because "giao trễ" is a
 * comparison against the due date rather than a status a row is put into.
 *
 * Mirrors BlueDental.Labo.LaboSampleFilter.
 */
export const LABO_SAMPLE_FILTER = {
  All: 0,
  AwaitingReturn: 1,
  Overdue: 2,
  Returned: 3,
} as const;

export type LaboSampleFilter = (typeof LABO_SAMPLE_FILTER)[keyof typeof LABO_SAMPLE_FILTER];

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

  /** Đơn hàng mới / Tiếp tục công đoạn / Bảo hành. */
  kind: LaboOrderKind;
  supplierId?: string;
  materialId?: string;
  biteId?: string;
  finishLineId?: string;
  rhythmId?: string;
  attachmentUrl?: string;

  supplierName?: string;
  materialName?: string;
  /** The labo service the material belongs to: "Dịch vụ hiện tại" on the child form. */
  laboServiceName?: string;
  biteName?: string;
  finishLineName?: string;
  rhythmName?: string;
  toothShade?: string;
  quantity: number;
  treatmentServiceId?: string;
  treatmentStageId?: string;

  /** The order this one continues or guarantees; absent on Đặt mới. */
  parentOrderId?: string;
  /**
   * The service line the order was raised from, named the way the child form
   * shows it: "DT01 - Bác sĩ" and the catalog service. Absent when the order
   * names no line.
   */
  treatmentPlanId?: string;
  treatmentPlanCode?: string;
  treatmentPlanDentistName?: string;
  treatmentServiceName?: string;
  treatmentServiceStatus?: number;

  /** Mẫu Giao Trễ — derived on the server from the due date. */
  isOverdue: boolean;
  /** Mẫu Chưa Nhận. */
  isAwaitingReturn: boolean;
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

export interface LaboOrderListParams {
  patientId?: string;
  dentistId?: string;
  status?: LaboStatus;
  /** Tình trạng mẫu — the counter pressed on the patient's Labo tab. */
  kind?: LaboOrderKind;
  sampleFilter?: LaboSampleFilter;
  /** Inclusive window over the day the order was raised, as `YYYY-MM-DD`. */
  fromDate?: string;
  toDate?: string;
  skipCount?: number;
  maxResultCount?: number;
}

/**
 * The counters over the patient's Labo tab, counted server-side over the
 * whole record the way the reference's `/clinic-order-status` does; they do
 * not follow the page or the counter pressed. Mirrors BlueDental.Labo.LaboStatsDto.
 */
export interface LaboStatsDto {
  total: number;
  new: number;
  continueStage: number;
  guarantee: number;
  awaitingReturn: number;
  overdue: number;
  returned: number;
}

export interface LaboStatsParams {
  patientId?: string;
}

export const laboApi = {
  list: (params: LaboOrderListParams): Promise<PagedResult<LaboOrderDto>> =>
    api.get("/v1/app/labo-orders", { params }).then((r) => r.data),

  stats: (params: LaboStatsParams): Promise<LaboStatsDto> =>
    api.get("/v1/app/labo-orders/stats", { params }).then((r) => r.data),

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

/**
 * One page of a patient's labo orders. The page, the counter pressed and
 * the total all come from the server, the way the reference pages its
 * `/clinic-orders?patientId=…&page=…&perPage=…&statusClinic=…`.
 */
export function usePatientLaboOrders(
  params: LaboOrderListParams & { patientId: string },
  enabled = true,
) {
  return useQuery({
    queryKey: ["labo-orders", params],
    queryFn: () => laboApi.list(params),
    enabled: enabled && Boolean(params.patientId),
    // Turning a page or pressing a counter narrows the table in place rather
    // than blanking it.
    placeholderData: (previous) => previous,
  });
}

/** The three counters over the patient's Labo tab. Lives under the orders key so every order mutation refreshes it. */
export function useLaboStats(params: LaboStatsParams) {
  return useQuery({
    queryKey: ["labo-orders", "stats", params],
    queryFn: () => laboApi.stats(params),
    enabled: Boolean(params.patientId),
  });
}

export function useLaboOrderList(params: LaboOrderListParams = {}) {
  return useQuery({
    queryKey: ["labo-orders", params],
    queryFn: () => laboApi.list(params),
    // Paging and switching filters should narrow the table in place rather
    // than blank it.
    placeholderData: (previous) => previous,
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
