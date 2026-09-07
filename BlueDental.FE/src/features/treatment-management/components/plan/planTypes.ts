import { t } from "@/lib/i18n";
import { formatVND } from "@/utils/format";
import { PLAN_STATUS } from "@/utils/planStatus";
import { SERVICE_LINE_STATUS } from "../../api/treatmentPlanApi";
import type { TreatmentPlanSlipDto, TreatmentServiceDto } from "../../api/treatmentPlanApi";

/**
 * The reference's configurable columns, in its default order. "Thêm công đoạn"
 * and "Thao tác" are fixed on either edge and cannot be hidden, so they are
 * not part of this list.
 */
export const PLAN_COLUMN_KEYS = [
  "code",
  "services",
  "dentist",
  "status",
  "createdAt",
  "total",
  "discount",
  "amount",
  "paid",
  "refund",
  "remaining",
  "receivable",
] as const;

export type PlanColumnKey = (typeof PLAN_COLUMN_KEYS)[number];

export interface PlanColumnSetting {
  key: PlanColumnKey;
  visible: boolean;
}

/** Vietnamese is the i18n key; wrap with t() at render time. */
export const PLAN_COLUMN_LABELS: Record<PlanColumnKey, string> = {
  code: "Số phiếu",
  services: "Danh sách dịch vụ",
  dentist: "Bác sĩ tiếp nhận",
  status: "Trạng thái - Tiến độ",
  createdAt: "Ngày tạo",
  total: "Tổng phiếu",
  discount: "Giảm giá",
  amount: "Thành tiền",
  paid: "Đã trả",
  refund: "Hoàn tiền",
  remaining: "Còn lại",
  receivable: "Phải thu",
};

export function defaultPlanColumns(): PlanColumnSetting[] {
  return PLAN_COLUMN_KEYS.map((key) => ({ key, visible: true }));
}

export interface PlanMoney {
  total: number;
  discount: number;
  amount: number;
  paid: number;
  refund: number;
  remaining: number;
  receivable: number;
}

/** The seven money columns, read off the slip's payment summary. */
export function planMoney(plan: TreatmentPlanSlipDto): PlanMoney {
  const payment = plan.payment;
  return {
    total: payment.totalPrice,
    discount: payment.discount,
    amount: payment.totalPrice - payment.discount,
    paid: payment.totalPaid,
    refund: payment.totalRefund,
    remaining: payment.debt,
    receivable: payment.receivable,
  };
}

/**
 * "Trạng thái - Tiến độ" pill. The reference labels a fresh slip "Đã tạo";
 * the other names follow its service-line pills.
 */
export const PLAN_PILL: Record<number, { label: string; modifier: string }> = {
  [PLAN_STATUS.Draft]: { label: "Đã tạo", modifier: "" },
  [PLAN_STATUS.PendingApproval]: { label: "Đã tạo", modifier: "" },
  [PLAN_STATUS.Approved]: { label: "Đã tạo", modifier: "" },
  [PLAN_STATUS.InProgress]: { label: "Đang điều trị", modifier: "tp-pill--converted" },
  [PLAN_STATUS.Completed]: { label: "Hoàn thành", modifier: "tp-pill--done" },
  [PLAN_STATUS.Cancelled]: { label: "Huỷ phiếu", modifier: "tp-pill--cancelled" },
};

/**
 * The reference's "Trạng thái - Tiến độ" column: an open slip whose lines have
 * not started yet still reads "Đã tạo"; it turns "Đang điều trị" with the
 * first stage. Local slips open straight into InProgress, so derive it here.
 */
export function planPill(plan: TreatmentPlanSlipDto) {
  const untouched = plan.services.every((service) => service.status === SERVICE_LINE_STATUS.Created);
  if (plan.status === PLAN_STATUS.InProgress && untouched) return PLAN_PILL[PLAN_STATUS.Draft];
  return PLAN_PILL[plan.status] ?? PLAN_PILL[PLAN_STATUS.Draft];
}

/** Every money cell on the tab carries the unit: "4.000.000 đ". */
export function moneyText(value: number | null | undefined) {
  return t("{0} đ", formatVND(value));
}

export const SERVICE_PILL: Record<number, { label: string; modifier: string }> = {
  [SERVICE_LINE_STATUS.Created]: { label: "Đã tạo", modifier: "" },
  [SERVICE_LINE_STATUS.InProgress]: { label: "Đang điều trị", modifier: "tp-pill--converted" },
  [SERVICE_LINE_STATUS.Done]: { label: "Hoàn thành", modifier: "tp-pill--done" },
  [SERVICE_LINE_STATUS.Cancelled]: { label: "Huỷ phiếu", modifier: "tp-pill--cancelled" },
  [SERVICE_LINE_STATUS.Replaced]: { label: "Chuyển đổi", modifier: "tp-pill--converted" },
};

/** A service line together with the slip it belongs to, for the flat lists. */
export interface PlanServiceRow {
  plan: TreatmentPlanSlipDto;
  service: TreatmentServiceDto;
}

export function flattenServices(plans: TreatmentPlanSlipDto[]): PlanServiceRow[] {
  return plans.flatMap((plan) => plan.services.map((service) => ({ plan, service })));
}

/**
 * Summary cards, derived client-side (the reference's summary endpoint only
 * ever answered with empty lists while observed — see docs/clone/unknowns.md).
 */
export function summariseServices(plans: TreatmentPlanSlipDto[]): {
  active: PlanServiceRow[];
  recent: PlanServiceRow[];
} {
  const rows = flattenServices(plans);
  return {
    active: rows.filter((row) => row.service.status === SERVICE_LINE_STATUS.InProgress),
    recent: rows.filter((row) => row.service.stageCount > 0),
  };
}
