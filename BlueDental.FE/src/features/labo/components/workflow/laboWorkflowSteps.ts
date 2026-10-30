import {
  LABO_STATUS,
  LABO_TOOTH_RESULT,
  type LaboOrderDto,
  type LaboStatus,
} from "@/features/labo/api/laboApi";
import type { LaboOrderSource } from "../order-dialogs/laboOrderSource";

/** The three tabs of the Labo dialog (P2910_03): Đặt hàng · Nhận hàng & kiểm tra · Bảo hành. */
export const LABO_STEPS = ["order", "check", "warranty"] as const;
export type LaboStep = (typeof LABO_STEPS)[number];

export function isLaboStep(value: string | null | undefined): value is LaboStep {
  return LABO_STEPS.some((step) => step === value);
}

/** Each tab's title and the line under the tabs, as i18n keys. */
export const LABO_STEP_COPY: Record<LaboStep, { label: string; hint: string }> = {
  order: { label: "Labo:Workflow:Step:Order", hint: "Labo:Workflow:Step:OrderHint" },
  check: { label: "Labo:Workflow:Step:Check", hint: "Labo:Workflow:Step:CheckHint" },
  warranty: { label: "Labo:Workflow:Step:Warranty", hint: "Labo:Workflow:Step:WarrantyHint" },
};

/**
 * What the dialog is opened on: a new order — raised from a công đoạn (the
 * line known) or from the Labo tab (picked in the header) — or a saved one,
 * on the tab a button asked for.
 */
export type LaboWorkflowTarget =
  | { kind: "create"; source?: LaboOrderSource | null }
  | { kind: "open"; orderId: string; step?: LaboStep };

/** The tab an order opens on when nothing asks for one: where its work is. */
const STATUS_STEP: Record<LaboStatus, LaboStep> = {
  [LABO_STATUS.Draft]: "order",
  [LABO_STATUS.Sent]: "check",
  [LABO_STATUS.AwaitingCheck]: "check",
  [LABO_STATUS.Returned]: "check",
  [LABO_STATUS.Completed]: "warranty",
  [LABO_STATUS.Cancelled]: "order",
  [LABO_STATUS.Warranty]: "warranty",
};

/**
 * A tab is locked (🔒) until the order reaches it: Nhận hàng & kiểm tra once
 * the order went to the lab — a cancelled one only if something came back —
 * and Bảo hành once a tooth passed, so a partly passed order shows its
 * passed teeth there before it is Hoàn thành.
 */
export function isStepOpen(step: LaboStep, order: LaboOrderDto | undefined): boolean {
  if (step === "order") return true;
  if (!order || order.status === LABO_STATUS.Draft) return false;
  if (step === "check") return order.status !== LABO_STATUS.Cancelled || order.rounds.length > 0;
  return order.teeth.some((tooth) => tooth.checkResult === LABO_TOOTH_RESULT.Passed);
}

/** The tab asked for when it is open, else the one the order's status points at. */
export function resolveStep(requested: LaboStep | undefined, order: LaboOrderDto | undefined): LaboStep {
  if (requested && isStepOpen(requested, order)) return requested;
  const step = order ? STATUS_STEP[order.status] : "order";
  return isStepOpen(step, order) ? step : "order";
}
