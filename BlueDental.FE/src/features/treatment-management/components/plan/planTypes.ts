import { t } from "@/lib/i18n";
import { formatVND } from "@/utils/format";
import { PLAN_STATUS } from "@/utils/planStatus";
import { SERVICE_LINE_STATUS } from "../../api/treatmentPlanApi";
import type {
  TreatmentPlanSlipDto,
  TreatmentServiceDto,
  TreatmentServiceStatus,
} from "../../api/treatmentPlanApi";
// Type-only: plan-detail/ imports this module, so a value import would close a cycle.
import type { PlanTabKey } from "../plan-detail/planDetailTypes";

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

export function planColumnLabels(): Record<PlanColumnKey, string> {
  return {
    code: t("Treatment:Plan:ColCode"),
    services: t("Treatment:Plan:ColServices"),
    dentist: t("Treatment:Plan:ColDentist"),
    status: t("Treatment:Plan:ColStatus"),
    createdAt: t("Treatment:Plan:ColCreatedAt"),
    total: t("Treatment:Plan:ColTotal"),
    discount: t("Treatment:Plan:ColDiscount"),
    amount: t("Treatment:Plan:ColAmount"),
    paid: t("Treatment:Plan:ColPaid"),
    refund: t("Treatment:Plan:ColRefund"),
    remaining: t("Treatment:Plan:ColRemaining"),
    receivable: t("Treatment:Plan:ColReceivable"),
  };
}

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

/**
 * The seven money columns, read off the slip's payment summary. Field for field
 * the reference's own row adapter (read from its bundle, 2026-09-21).
 *
 * `payment.totalPrice` is already net of every discount — it is what the patient
 * owes. "Tổng phiếu" is the gross the reference prints above the discount, so it
 * is rebuilt by adding the discount back; that keeps the row's arithmetic
 * ("Tổng phiếu" − "Giảm giá" = "Thành tiền") true by construction.
 *
 * "Phải thu" is clamped at zero: the payload goes negative once the patient has
 * paid ahead of the finished work, and the reference hides that behind its own
 * `resolveReceivable`. "Còn lại" is left as it comes — it is the whole of what
 * the slip still owes.
 */
export function planMoney(plan: TreatmentPlanSlipDto): PlanMoney {
  const payment = plan.payment;
  return {
    total: payment.totalPrice + payment.discount,
    discount: payment.discount,
    amount: payment.totalPrice,
    paid: payment.totalPaid,
    refund: payment.totalRefund,
    remaining: payment.debt,
    receivable: Math.max(0, payment.receivable),
  };
}

/**
 * How a money cell is coloured. The reference gives each column a fixed tone,
 * except the two it only paints red while there is something to chase:
 * "Còn lại" and "Phải thu" fall back to the label grey at zero.
 */
const MONEY_TONE: Record<keyof PlanMoney, "ink" | "discount" | "paid" | "dueWhenOwed"> = {
  total: "ink",
  discount: "discount",
  amount: "ink",
  paid: "paid",
  refund: "ink",
  remaining: "dueWhenOwed",
  receivable: "dueWhenOwed",
};

const MONEY_TONE_CLASS = {
  ink: "",
  // "Giảm giá" is the one figure the reference leaves at the regular weight.
  discount: "tp-cell-money--discount",
  paid: "tp-cell-money--paid",
} as const;

export function moneyCellClass(field: keyof PlanMoney, value: number): string {
  const tone = MONEY_TONE[field];
  const modifier =
    tone === "dueWhenOwed"
      ? value > 0
        ? "tp-cell-money--due"
        : "tp-cell-money--muted"
      : MONEY_TONE_CLASS[tone];
  return ["tp-cell-money", modifier].filter(Boolean).join(" ");
}

/**
 * "Trạng thái - Tiến độ" pill. The reference labels a fresh slip "Đã tạo";
 * the other names follow its service-line pills.
 */
export function planPills(): Record<number, { label: string; modifier: string }> {
  return {
    [PLAN_STATUS.Draft]: { label: t("Treatment:Plan:StatusCreated"), modifier: "" },
    [PLAN_STATUS.PendingApproval]: { label: t("Treatment:Plan:StatusCreated"), modifier: "" },
    [PLAN_STATUS.Approved]: { label: t("Treatment:Plan:StatusCreated"), modifier: "" },
    [PLAN_STATUS.InProgress]: { label: t("Treatment:Plan:StatusInProgress"), modifier: "tp-pill--progress" },
    [PLAN_STATUS.Completed]: { label: t("Treatment:Plan:StatusCompleted"), modifier: "tp-pill--done" },
    [PLAN_STATUS.Cancelled]: { label: t("Treatment:Plan:StatusCancelled"), modifier: "tp-pill--cancelled" },
  };
}

/**
 * The reference tints a whole row by the slip's status (its own `rowClass`):
 * a finished slip goes green and a slip under warranty goes blue. It names a
 * red class for a cancelled slip too, but that class is not defined anywhere in
 * its stylesheet, so a cancelled row renders untinted — which is what happens
 * here as well.
 */
export function planRowClass(plan: TreatmentPlanSlipDto): string {
  return plan.status === PLAN_STATUS.Completed ? "tp-row--done" : "";
}

/**
 * The reference's "Trạng thái - Tiến độ" column: an open slip whose lines have
 * not started yet still reads "Đã tạo"; it turns "Đang điều trị" with the
 * first stage. Local slips open straight into InProgress, so derive it here.
 */
export function planPill(plan: TreatmentPlanSlipDto) {
  const pills = planPills();
  const untouched = plan.services.every((service) => service.status === SERVICE_LINE_STATUS.Created);
  if (plan.status === PLAN_STATUS.InProgress && untouched) return pills[PLAN_STATUS.Draft];
  return pills[plan.status] ?? pills[PLAN_STATUS.Draft];
}

/** The slip's own screen — where the code links and the summary cards lead. */
/**
 * The slip's own screen.
 *
 * `tab` is left off by default on purpose: the reference's DT code chip lands
 * on `?branchId=` alone and lets the page fall back to Chi tiết, while the
 * jumps that mean a particular tab — "Thanh toán" on "Chi tiết phiếu" — spell
 * `planTab=` out ahead of the branch. Both measured 2026-09-07.
 */
export function planDetailPath(
  patientId: string,
  planId: string,
  branchId: string,
  tab?: PlanTabKey,
): string {
  const params = new URLSearchParams();
  if (tab) params.set("planTab", tab);
  if (branchId) params.set("branchId", branchId);
  const search = params.toString();
  return `/patient/${patientId}/treatment-plan/${planId}${search ? `?${search}` : ""}`;
}

/** Every money cell on the tab carries the unit: "4.000.000 đ". */
export function moneyText(value: number | null | undefined) {
  return t("Treatment:Pricing:MoneyFormat", formatVND(value));
}

/**
 * The seven line pills, in the reference's own palette (read from its bundle,
 * 2026-09-21): "Đang điều trị" and "Bảo hành" share a blue, "Chuyển đổi" is
 * cyan, "Đã chuyển" is violet, and a cancelled line reads "Hủy dịch vụ" —
 * "Huỷ phiếu" is the wording for a whole slip.
 */
export function servicePills(): Record<number, { label: string; modifier: string }> {
  return {
    [SERVICE_LINE_STATUS.Created]: { label: t("Treatment:Service:StatusCreated"), modifier: "" },
    [SERVICE_LINE_STATUS.InProgress]: { label: t("Treatment:Service:StatusInProgress"), modifier: "tp-pill--progress" },
    [SERVICE_LINE_STATUS.Done]: { label: t("Treatment:Service:StatusDone"), modifier: "tp-pill--done" },
    [SERVICE_LINE_STATUS.Cancelled]: { label: t("Treatment:Service:StatusCancelled"), modifier: "tp-pill--cancelled" },
    [SERVICE_LINE_STATUS.Replaced]: { label: t("Treatment:Service:StatusReplaced"), modifier: "tp-pill--converted" },
    [SERVICE_LINE_STATUS.Warranty]: { label: t("Treatment:Service:StatusWarranty"), modifier: "tp-pill--progress" },
    [SERVICE_LINE_STATUS.Transferred]: { label: t("Treatment:Service:StatusTransferred"), modifier: "tp-pill--transferred" },
  };
}

export function newLineStatuses(): readonly { value: TreatmentServiceStatus; label: string }[] {
  return [
    { value: SERVICE_LINE_STATUS.Created, label: t("Treatment:Service:StatusCreated") },
    { value: SERVICE_LINE_STATUS.InProgress, label: t("Treatment:Service:StatusInProgress") },
    { value: SERVICE_LINE_STATUS.Done, label: t("Treatment:Service:StatusDone") },
    { value: SERVICE_LINE_STATUS.Replaced, label: t("Treatment:Service:StatusReplaced") },
    { value: SERVICE_LINE_STATUS.Transferred, label: t("Treatment:Service:StatusTransferred") },
    { value: SERVICE_LINE_STATUS.Warranty, label: t("Treatment:Service:StatusWarranty") },
    { value: SERVICE_LINE_STATUS.Cancelled, label: t("Treatment:Service:StatusCancelled") },
  ];
}

/** A service line together with the slip it belongs to, for the flat lists. */
export interface PlanServiceRow {
  plan: TreatmentPlanSlipDto;
  service: TreatmentServiceDto;
}

export function flattenServices(plans: TreatmentPlanSlipDto[]): PlanServiceRow[] {
  return plans.flatMap((plan) => plan.services.map((service) => ({ plan, service })));
}

/** The reference shows at most four items per summary card. */
export const SUMMARY_CARD_LIMIT = 4;

export interface PlanSummary {
  /** At most {@link SUMMARY_CARD_LIMIT} rows — what the card draws. */
  active: PlanServiceRow[];
  /** Every line in treatment; the card's badge counts these, not the four shown. */
  activeCount: number;
  recent: PlanServiceRow[];
}

/**
 * Summary cards, derived client-side (the reference's summary endpoint only
 * ever answered with empty lists while observed — see docs/clone/unknowns.md).
 *
 * Both cards are capped at four items, as the reference caps them; only the
 * first card carries a badge, and that badge counts every line in treatment.
 */
export function summariseServices(plans: TreatmentPlanSlipDto[]): PlanSummary {
  const rows = flattenServices(plans);
  const active = rows.filter((row) => row.service.status === SERVICE_LINE_STATUS.InProgress);
  const recent = rows.filter((row) => row.service.stageCount > 0);
  return {
    active: active.slice(0, SUMMARY_CARD_LIMIT),
    activeCount: active.length,
    recent: recent.slice(0, SUMMARY_CARD_LIMIT),
  };
}
