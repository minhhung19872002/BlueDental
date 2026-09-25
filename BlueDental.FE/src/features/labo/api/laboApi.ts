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
  /** "Giao trễ" — picked by hand in the detail dialog, as on the reference. */
  LateDelivery: 7,
  /** "Đã thay thế". */
  Replaced: 8,
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
  /** The reference's `statusClinic: canceled` — pulled back by the clinic. */
  Canceled: 4,
} as const;

export type LaboOrderKind = (typeof LABO_ORDER_KIND)[keyof typeof LABO_ORDER_KIND];

/**
 * The pill tones the reference paints on Mẫu Labo, measured on staging on
 * 2026-09-24 (docs/clone/pages/labo.md §2.5): info blue for a new order or
 * sample, green once delivered, red once cancelled, purple for a guarantee or
 * a replaced order, amber for a late one, and grey for anything in flight.
 */
export const LABO_PILL_TONE = {
  info: { bg: "#e0f2fe", color: "#008af5" },
  success: { bg: "#ecfdf5", color: "#57bc6c" },
  danger: { bg: "#fff1f2", color: "#d57463" },
  purple: { bg: "#f5f3ff", color: "#6c3cf0" },
  warning: { bg: "#fffbeb", color: "#d97706" },
  gray: { bg: "#f7f8fd", color: "#171c33" },
} as const;

/**
 * "Tình trạng mẫu" — the pill under Ngày gửi on the patient's Labo tab and
 * Mẫu Labo, one per kind.
 */
export const LABO_KIND_CONFIG: Record<LaboOrderKind, { label: string; bg: string; color: string }> =
  {
    [LABO_ORDER_KIND.New]: { label: "Patient:Labo:Sample:New", ...LABO_PILL_TONE.info },
    [LABO_ORDER_KIND.ContinueStage]: {
      label: "Patient:Labo:Sample:Continue",
      ...LABO_PILL_TONE.info,
    },
    [LABO_ORDER_KIND.Guarantee]: {
      label: "Patient:Labo:Sample:Warranty",
      ...LABO_PILL_TONE.purple,
    },
    // Both pills read "Đã huỷ" on staging once the service line's Labo slips are
    // cancelled from the Chuyển đổi dialog (2026-09-24).
    [LABO_ORDER_KIND.Canceled]: { label: "Patient:Labo:Status:Rejected", ...LABO_PILL_TONE.danger },
  };

export const LABO_STATUS_CONFIG: Record<LaboStatus, { label: string; bg: string; color: string }> =
  {
    [LABO_STATUS.Draft]: { label: "Patient:Labo:Status:Draft", ...LABO_PILL_TONE.info },
    [LABO_STATUS.Sent]: { label: "Patient:Labo:Status:Sent", ...LABO_PILL_TONE.gray },
    [LABO_STATUS.InProgress]: { label: "Patient:Labo:Status:InProgress", ...LABO_PILL_TONE.gray },
    [LABO_STATUS.Received]: { label: "Patient:Labo:Status:Received", ...LABO_PILL_TONE.success },
    [LABO_STATUS.Completed]: { label: "Patient:Labo:Status:Completed", ...LABO_PILL_TONE.success },
    [LABO_STATUS.Rejected]: { label: "Patient:Labo:Status:Rejected", ...LABO_PILL_TONE.danger },
    [LABO_STATUS.LateDelivery]: {
      label: "Patient:Labo:Status:LateDelivery",
      ...LABO_PILL_TONE.warning,
    },
    [LABO_STATUS.Replaced]: { label: "Patient:Labo:Status:Replaced", ...LABO_PILL_TONE.purple },
  };

/**
 * The five states the detail dialog's Trạng thái select offers, in the
 * reference's order: created, delivered, canceled, lateDelivery, replaced.
 */
export const LABO_DETAIL_STATUS_OPTIONS: readonly LaboStatus[] = [
  LABO_STATUS.Draft,
  LABO_STATUS.Received,
  LABO_STATUS.Rejected,
  LABO_STATUS.LateDelivery,
  LABO_STATUS.Replaced,
];

/**
 * The four filters above the Mẫu Labo table. The reference sends one status
 * code per tab (`created`, `lateDelivery`, `delivered`) and nothing else;
 * BlueDental sends the tab and the server maps it onto the same statuses —
 * "chưa nhận" is every order not back from the lab, from the moment it is
 * written, and "giao trễ" only what the detail dialog filed there.
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

/**
 * The treatment line's "Hoàn thành" — BlueDental.TreatmentManagement
 * .TreatmentServiceStatus.Done. Mirrored here rather than imported so the
 * labo feature stays clear of treatment-management.
 */
const TREATMENT_SERVICE_DONE = 3;

/**
 * Whether "Tiếp tục công đoạn" may still be raised on the row: the reference
 * hides the plus once the treatment line behind the order is done.
 */
export function canContinueLaboOrder(order: LaboOrderDto): boolean {
  return order.treatmentServiceStatus !== TREATMENT_SERVICE_DONE;
}

/** One picture attached to the order through the detail dialog. */
export interface LaboOrderImageDto {
  id: string;
  /** Same-origin content URL, served by the API. */
  url: string;
  fileName: string;
}

export interface LaboOrderDto {
  id: string;
  orderCode: string;
  patientId: string;
  patientName?: string;
  patientCode?: string;
  /** ISO date; the printed sheet's "Ngày sinh". */
  patientDateOfBirth?: string;
  dentistId?: string;
  dentistName?: string;
  labProviderName: string;
  status: LaboStatus;
  toothNumbers?: string;
  workDescription?: string;
  notes?: string;
  /** Ngày nhận dự kiến + Giờ nhận, one ISO stamp. */
  dueAt?: string;
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
  /** The pictures behind "File phòng khám gửi về", oldest first. */
  images: LaboOrderImageDto[];
}

export interface CreateLaboOrderDto {
  patientId: string;
  dentistId?: string;
  labProviderName: string;
  toothNumbers?: string;
  workDescription?: string;
  notes?: string;
  /** Ngày nhận dự kiến + Giờ nhận, one ISO stamp. */
  dueAt?: string;
  estimatedCost: number;
}

/** The detail dialog's Lưu: the status picked, the saved pictures kept and the new ones added. */
export interface SaveLaboOrderDetailInput {
  status: LaboStatus;
  /** Every saved picture still on the strip; the rest are removed. */
  keepImageIds: string[];
  pictures: File[];
}

export interface UpdateLaboOrderDto {
  labProviderName?: string;
  toothNumbers?: string;
  workDescription?: string;
  notes?: string;
  /** Ngày nhận dự kiến + Giờ nhận, one ISO stamp. */
  dueAt?: string;
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

  /** One multipart PUT, the way the order itself goes up with its pictures. */
  saveDetail: (id: string, input: SaveLaboOrderDetailInput): Promise<LaboOrderDto> => {
    const form = new FormData();
    form.append("status", String(input.status));
    for (const imageId of input.keepImageIds) form.append("keepImageIds", imageId);
    for (const file of input.pictures) form.append("pictures", file);
    return api.put(`/v1/app/labo-orders/${id}/detail`, form).then((r) => r.data);
  },
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

/**
 * The plan slip and Hình ảnh read orders too, so every order write names the
 * entity; each hook still awaits its own list refetch before it settles.
 */
const INVALIDATES_LABO_ORDERS = { invalidates: ["laboOrder"] } as const;

export function useCreateLaboOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateLaboOrderDto) => laboApi.create(data),
    meta: INVALIDATES_LABO_ORDERS,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["labo-orders"] }),
  });
}

export function useUpdateLaboOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateLaboOrderDto }) =>
      laboApi.update(id, data),
    meta: INVALIDATES_LABO_ORDERS,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["labo-orders"] }),
  });
}

export function useSaveLaboOrderDetail() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: SaveLaboOrderDetailInput }) =>
      laboApi.saveDetail(id, input),
    meta: INVALIDATES_LABO_ORDERS,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["labo-orders"] }),
  });
}

export function useDeleteLaboOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => laboApi.delete(id),
    meta: INVALIDATES_LABO_ORDERS,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["labo-orders"] }),
  });
}
