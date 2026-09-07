import { t } from "@/lib/i18n";
import { formatVND } from "@/utils/format";
import { DISCOUNT_TYPE, type PatientAdviseDto } from "../../api/consultingApi";
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

/** Vietnamese is the i18n key; wrap with t() at render time. */
export const PLAN_TAB_LABELS: Record<PlanTabKey, string> = {
  [PLAN_TAB.detail]: "Chi tiết",
  [PLAN_TAB.payment]: "Thanh toán",
  [PLAN_TAB.refund]: "Hoàn tiền",
  [PLAN_TAB.debt]: "Dư nợ",
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

/** The "Tổng giảm giá" tooltip: how the discount was written on the line. */
export function discountTooltip(service: TreatmentServiceDto): string {
  if (service.discountType === DISCOUNT_TYPE.Percentage) {
    return t("Giảm {0}% trên đơn giá", service.discountValue);
  }
  if (service.discountType === DISCOUNT_TYPE.Money) {
    return t("Giảm {0} đ", formatVND(service.discountValue));
  }
  return t("Không giảm giá");
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
