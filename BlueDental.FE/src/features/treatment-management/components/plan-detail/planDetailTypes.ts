import { t } from "@/lib/i18n";
import { formatVND } from "@/utils/format";
import type { PatientAdviseDto } from "../../api/consultingApi";
import {
  SERVICE_LINE_STATUS,
  type PatientPaymentDto,
  type TreatmentPlanSlipDto,
  type TreatmentServiceDto,
} from "../../api/treatmentPlanApi";
import type { DraftServiceController } from "./useDraftServiceRow";

/** The four sub-screens, keyed as the reference writes them in `planTab=`. */
export const PLAN_TAB = {
  detail: "detail",
  payment: "payment-v2",
  refund: "refund",
  debt: "debt",
} as const;
export type PlanTabKey = (typeof PLAN_TAB)[keyof typeof PLAN_TAB];

export const PLAN_TAB_KEYS: PlanTabKey[] = [
  PLAN_TAB.detail,
  PLAN_TAB.payment,
  PLAN_TAB.refund,
  PLAN_TAB.debt,
];

/** i18n keys; wrap with t() at render time. */
export const PLAN_TAB_LABELS: Record<PlanTabKey, string> = {
  [PLAN_TAB.detail]: "Treatment:PlanDetail:Tab:Detail",
  [PLAN_TAB.payment]: "Treatment:PlanDetail:Tab:Payment",
  [PLAN_TAB.refund]: "Treatment:PlanDetail:Tab:Refund",
  [PLAN_TAB.debt]: "Treatment:PlanDetail:Tab:Debt",
};

export function isPlanTab(value: string | null): value is PlanTabKey {
  return PLAN_TAB_KEYS.some((key) => key === value);
}

/** One service line of the slip, with the advise it was written from (if any). */
export interface PlanDetailRow {
  /** 1-based position on the slip — the card head on narrow screens. */
  index: number;
  plan: TreatmentPlanSlipDto;
  service: TreatmentServiceDto;
  advise: PatientAdviseDto | null;
  /** Set while "Chỉnh sửa" has turned this line into the inline row. */
  edit?: DraftServiceController;
}

/** The inline "new row" the picker puts above the lines, until Lưu or Hủy. */
export interface DraftServiceRow {
  kind: "draft";
  draft: DraftServiceController;
}

export type ServiceTableRow = PlanDetailRow | DraftServiceRow;

export const DRAFT_ROW_KEY = "draft";

export function isDraftRow(row: ServiceTableRow): row is DraftServiceRow {
  return "kind" in row && row.kind === "draft";
}

export function planDetailRows(
  plan: TreatmentPlanSlipDto,
  advises: PatientAdviseDto[],
): PlanDetailRow[] {
  const byId = new Map(advises.map((advise) => [advise.id, advise]));
  return plan.services.map((service, position) => ({
    index: position + 1,
    plan,
    service,
    advise: service.sourceAdviseId ? (byId.get(service.sourceAdviseId) ?? null) : null,
  }));
}

/**
 * "Tạm ứng" of one service line: what was collected on it beyond the work it
 * has actually delivered. A line only delivers value once it is finished, so
 * everything paid on an open line is still an advance.
 */
export function advanceOn(service: TreatmentServiceDto): number {
  const earned = service.status === SERVICE_LINE_STATUS.Done ? service.effectiveAmount : 0;
  return Math.max(service.paidAmount - earned, 0);
}

/** Empty text cells read "—" on the reference. */
export function dash(value: string | null | undefined): string {
  return value && value.trim() ? value : "—";
}

/** Lines the status menu can still act on. */
export function isLineOpen(service: TreatmentServiceDto): boolean {
  return (
    service.status === SERVICE_LINE_STATUS.Created ||
    service.status === SERVICE_LINE_STATUS.InProgress
  );
}

/**
 * The four parts of "Tổng giảm giá", in the order staging's tooltip prints
 * them (2026-09-28): Giảm dịch vụ · Voucher dịch vụ · Giảm KHDT · Voucher KHDT.
 */
export interface DiscountParts {
  /** `serviceDiscount` — a unit price lowered below the giá gốc, plus any carried-over line discount. */
  service: number;
  /** `serviceVoucher` — vouchers on this line alone. BlueDental redeems vouchers on the slip only, so 0. */
  serviceVoucher: number;
  /** `khdtDiscount` — the line's share of the slip's own discount. */
  plan: number;
  /** `khdtVoucher` — the line's share of the slip's vouchers. */
  planVoucher: number;
}

export function lineDiscountParts(service: TreatmentServiceDto): DiscountParts {
  return {
    service: service.serviceDiscountAmount,
    serviceVoucher: 0,
    plan: service.planDiscountShare,
    planVoucher: service.planVoucherShare,
  };
}

/**
 * The new row, which staging recomputes on every keystroke: what lowering the
 * catalog price takes off. A row has no slip share until it is saved.
 */
export function draftDiscountParts(originalPrice: number, price: number, quantity: number): DiscountParts {
  return {
    service: Math.max(originalPrice - price, 0) * Math.max(quantity, 0),
    serviceVoucher: 0,
    plan: 0,
    planVoucher: 0,
  };
}

export function totalDiscount(parts: DiscountParts): number {
  return parts.service + parts.serviceVoucher + parts.plan + parts.planVoucher;
}

/** The tooltip's four lines — zeros included, as staging prints them. */
export function discountTooltipLines(parts: DiscountParts): string[] {
  return [
    t("Treatment:Pricing:Tip:ServiceDiscount", formatVND(parts.service)),
    t("Treatment:Pricing:Tip:ServiceVoucher", formatVND(parts.serviceVoucher)),
    t("Treatment:Pricing:Tip:PlanDiscount", formatVND(parts.plan)),
    t("Treatment:Pricing:Tip:PlanVoucher", formatVND(parts.planVoucher)),
  ];
}

/** "Đơn giá" of a saved line: its giá gốc, before anything is taken off. */
export function listUnitPrice(service: TreatmentServiceDto): number {
  return service.originalPrice > 0 ? service.originalPrice : service.price;
}

/**
 * "Thành tiền" of a saved line — after every discount, so the lines add up to
 * the slip. A line the slip no longer charges has no slip share.
 */
export function lineNetAmount(service: TreatmentServiceDto): number {
  return service.effectiveAmount - service.planDiscountShare - service.planVoucherShare;
}

/**
 * Staging's check on ✓ for both the new row and an edited line: the unit
 * price may be lowered below the giá gốc, never raised above it. No giá gốc
 * (0) means no ceiling. Returns the message to print under the input.
 */
export function unitPriceError(price: number, originalPrice: number): string | null {
  return originalPrice > 0 && price > originalPrice ? t("Treatment:Pricing:UnitPriceAboveOriginal") : null;
}

/** Service names a receipt covers, in slip order — "Dịch vụ điều trị". */
export function paymentServiceNames(
  payment: PatientPaymentDto,
  plan: TreatmentPlanSlipDto,
): string {
  const chosen = new Set(payment.lines.map((line) => line.treatmentServiceId));
  const names = plan.services
    .filter((service) => chosen.has(service.id))
    .map((service) => service.serviceName);
  return names.length > 0 ? names.join(", ") : "—";
}

/** What each line has already given back — the "Đã hoàn" column of the refund form. */
export function refundedByService(refunds: PatientPaymentDto[]): Map<string, number> {
  const totals = new Map<string, number>();
  for (const refund of refunds) {
    for (const line of refund.lines) {
      totals.set(line.treatmentServiceId, (totals.get(line.treatmentServiceId) ?? 0) + line.amount);
    }
  }
  return totals;
}
