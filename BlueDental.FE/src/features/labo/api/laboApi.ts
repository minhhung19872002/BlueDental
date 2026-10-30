import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/axios";
import type { PagedResult } from "@/types";

// ── Types ─────────────────────────────────────────────────────────────────

/**
 * Matches BlueDental.Labo.LaboStatus on the server — the BA's workflow
 * (P2910_03). "Hết hạn bảo hành" is not stored: it is a Bảo hành order whose
 * every card has run out, read off {@link LaboOrderDto.isWarrantyExpired}.
 */
export const LABO_STATUS = {
  Draft: 1,
  Sent: 2,
  AwaitingCheck: 3,
  Returned: 4,
  Completed: 5,
  Cancelled: 6,
  Warranty: 7,
} as const;
export type LaboStatus = (typeof LABO_STATUS)[keyof typeof LABO_STATUS];

/** Đạt / Lỗi of one tooth. Mirrors BlueDental.Labo.LaboToothCheckResult. */
export const LABO_TOOTH_RESULT = { None: 0, Passed: 1, Failed: 2 } as const;
export type LaboToothResult = (typeof LABO_TOOTH_RESULT)[keyof typeof LABO_TOOTH_RESULT];

/** How a receive-and-check round ended. Mirrors BlueDental.Labo.LaboRoundOutcome. */
export const LABO_ROUND_OUTCOME = { Pending: 0, Passed: 1, ReturnedAll: 2, ReturnedDefective: 3 } as const;
export type LaboRoundOutcome = (typeof LABO_ROUND_OUTCOME)[keyof typeof LABO_ROUND_OUTCOME];

/** Kết luận of a check. Mirrors BlueDental.Labo.LaboCheckConclusion. */
export const LABO_CHECK_CONCLUSION = { Pass: 1, ReturnAll: 2, ReturnDefective: 3 } as const;
export type LaboCheckConclusion = (typeof LABO_CHECK_CONCLUSION)[keyof typeof LABO_CHECK_CONCLUSION];

/** The six filter cards on the patient's Labo tab. Mirrors BlueDental.Labo.LaboStatusFilter. */
export const LABO_STATUS_FILTER = {
  Draft: 1,
  Returned: 2,
  AwaitingCheck: 3,
  Completed: 4,
  InWarranty: 5,
  WarrantyExpired: 6,
} as const;
export type LaboStatusFilter = (typeof LABO_STATUS_FILTER)[keyof typeof LABO_STATUS_FILTER];

/**
 * Why the sample was sent. Every order since P2910_03 is New; the other kinds
 * survive on the child orders raised before it. Mirrors BlueDental.Labo.LaboOrderKind.
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
 * The four filters above the Mẫu Labo table: Chưa nhận is an order at the
 * lab (Đã gửi Labo / Trả hàng), Giao trễ one of those past its due day, Đã
 * nhận one back at least once. Mirrors BlueDental.Labo.LaboSampleFilter.
 */
export const LABO_SAMPLE_FILTER = {
  All: 0,
  AwaitingReturn: 1,
  Overdue: 2,
  Returned: 3,
} as const;
export type LaboSampleFilter = (typeof LABO_SAMPLE_FILTER)[keyof typeof LABO_SAMPLE_FILTER];

/** One picture of the order. */
export interface LaboOrderImageDto {
  id: string;
  /** Same-origin content URL, served by the API. */
  url: string;
  fileName: string;
  /** The check round this is an Ảnh kiểm tra of; absent for Hình ảnh gửi Labo. */
  roundNo?: number | null;
}

/** One tooth of the order, with its check result and warranty card. */
export interface LaboOrderToothDto {
  toothNumber: number;
  checkResult: LaboToothResult;
  defectNote?: string | null;
  passedAt?: string | null;
  warrantyCardCode?: string | null;
  manufacturerSerial?: string | null;
  /** `YYYY-MM-DD`. */
  warrantyStartDate?: string | null;
  warrantyMonths?: number | null;
  /** `YYYY-MM-DD`. */
  warrantyEndDate?: string | null;
  warrantyConditions?: string | null;
  warrantyActivatedAt?: string | null;
  isWarrantyExpired: boolean;
}

export interface LaboRoundToothResultDto {
  toothNumber: number;
  result: LaboToothResult;
  /** Ghi chú lỗi. */
  note?: string | null;
}

/** One row of Lịch sử nhận hàng & trả hàng. */
export interface LaboOrderRoundDto {
  roundNo: number;
  receivedAt: string;
  receivedQuantity: number;
  receiverId?: string | null;
  receiverName?: string | null;
  checkedAt?: string | null;
  outcome: LaboRoundOutcome;
  returnDescription?: string | null;
  returnedAt?: string | null;
  redeliveryDueAt?: string | null;
  toothResults: LaboRoundToothResultDto[];
}

export interface LaboOrderDto {
  id: string;
  orderCode: string;
  patientId: string;
  branchId: string;
  patientName?: string;
  patientCode?: string;
  /** ISO date; the printed sheet's "Ngày sinh". */
  patientDateOfBirth?: string;
  dentistId?: string;
  dentistName?: string;
  /** Chức danh of the doctor above — what printed sheets name them by. */
  dentistJobTitle?: string | null;
  labProviderName: string;
  status: LaboStatus;
  /** The teeth joined for tables and print, e.g. "11, 21". */
  toothNumbers?: string;
  workDescription?: string;
  notes?: string;
  /** The due stamp in force: Ngày nhận dự kiến, or Hẹn Labo giao lại after a return. */
  dueAt?: string;
  sentAt?: string;
  receivedAt?: string;
  estimatedCost: number;
  creationTime: string;

  kind: LaboOrderKind;
  supplierId?: string;
  materialId?: string;
  biteId?: string;
  finishLineId?: string;
  rhythmId?: string;

  supplierName?: string;
  /** The supplier's badge colour, "#RRGGBB"; absent reads grey (R-1072). */
  supplierLabelColor?: string | null;
  materialName?: string;
  /** The labo service the material belongs to (Lựa chọn dịch vụ). */
  laboServiceName?: string;
  /** That group's id, so a reopened Nháp lands on its Lựa chọn dịch vụ chip. */
  laboServiceId?: string;
  biteName?: string;
  finishLineName?: string;
  rhythmName?: string;
  toothShade?: string;
  quantity: number;
  treatmentServiceId?: string;
  treatmentStageId?: string;

  /** The order an old child order continued or guaranteed; absent since P2910_03. */
  parentOrderId?: string;
  /** The plan line the order is for: "DT01 - Bác sĩ" and the catalog service. */
  treatmentPlanId?: string;
  treatmentPlanCode?: string;
  treatmentPlanDentistName?: string;
  treatmentServiceName?: string;
  treatmentServiceStatus?: number;

  /** At the lab (Đã gửi Labo / Trả hàng) past the day it was due. */
  isOverdue: boolean;
  /** At the lab (Đã gửi Labo / Trả hàng). */
  isAwaitingReturn: boolean;
  /** Bảo hành whose every card has run out — "Hết hạn bảo hành". */
  isWarrantyExpired: boolean;
  /** Số lần trả hàng. */
  returnCount: number;
  teeth: LaboOrderToothDto[];
  /** Lịch sử nhận hàng & trả hàng, oldest first. */
  rounds: LaboOrderRoundDto[];
  /** Hình ảnh gửi Labo (no round) and each round's Ảnh kiểm tra, oldest first. */
  images: LaboOrderImageDto[];
}

// ── API ───────────────────────────────────────────────────────────────────

export interface LaboOrderListParams {
  patientId?: string;
  dentistId?: string;
  status?: LaboStatus;
  /** The filter card pressed on the patient's Labo tab. */
  statusFilter?: LaboStatusFilter;
  sampleFilter?: LaboSampleFilter;
  /** Inclusive window over the day the order was raised, as `YYYY-MM-DD`. */
  fromDate?: string;
  toDate?: string;
  skipCount?: number;
  maxResultCount?: number;
}

/**
 * The counters behind the Labo tab's six filter cards and the Mẫu Labo
 * chips, counted server-side over the whole record; they do not follow the
 * page or the card pressed. Mirrors BlueDental.Labo.LaboStatsDto.
 */
export interface LaboStatsDto {
  total: number;
  draft: number;
  returned: number;
  awaitingCheck: number;
  completed: number;
  inWarranty: number;
  warrantyExpired: number;
  awaitingReturn: number;
  overdue: number;
  received: number;
}

export interface LaboStatsParams {
  patientId?: string;
}

export const LABO_ORDERS_URL = "/v1/app/labo-orders";

export const laboApi = {
  list: (params: LaboOrderListParams): Promise<PagedResult<LaboOrderDto>> =>
    api.get(LABO_ORDERS_URL, { params }).then((r) => r.data),

  stats: (params: LaboStatsParams): Promise<LaboStatsDto> =>
    api.get(`${LABO_ORDERS_URL}/stats`, { params }).then((r) => r.data),

  get: (id: string): Promise<LaboOrderDto> =>
    api.get(`${LABO_ORDERS_URL}/${id}`).then((r) => r.data),
};

// ── Hooks ─────────────────────────────────────────────────────────────────

/**
 * One page of a patient's labo orders. The page, the card pressed and the
 * total all come from the server.
 */
export function usePatientLaboOrders(
  params: LaboOrderListParams & { patientId: string },
  enabled = true,
) {
  return useQuery({
    queryKey: ["labo-orders", params],
    queryFn: () => laboApi.list(params),
    enabled: enabled && Boolean(params.patientId),
    // Turning a page or pressing a card narrows the table in place rather
    // than blanking it.
    placeholderData: (previous) => previous,
  });
}

/** The six cards over the patient's Labo tab. Lives under the orders key so every order mutation refreshes it. */
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

/** One order, read fresh whenever the workflow dialog opens on it. */
export function useLaboOrder(id: string | null | undefined) {
  return useQuery({
    queryKey: ["labo-orders", "one", id],
    queryFn: () => laboApi.get(id ?? ""),
    enabled: Boolean(id),
  });
}
