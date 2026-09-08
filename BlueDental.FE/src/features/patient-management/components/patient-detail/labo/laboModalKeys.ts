import { LABO_ORDER_KIND, type LaboOrderKind } from "@/features/labo/api/laboApi";

/**
 * The reference's `laboModal` query value — one per tab of the order dialog.
 * `laboRowId` rides along with it on the two child tabs, naming the parent.
 */
export const LABO_MODAL_PARAM = "laboModal";
export const LABO_ROW_PARAM = "laboRowId";

export const LABO_MODAL_KEYS = ["new-order", "continue-process", "warranty"] as const;
export type LaboModalKey = (typeof LABO_MODAL_KEYS)[number];
export type LaboChildKind = Exclude<LaboModalKey, "new-order">;

export const LABO_MODAL_LABELS: Record<LaboModalKey, string> = {
  "new-order": "Đặt mới",
  "continue-process": "Làm tiếp công đoạn",
  warranty: "Bảo hành",
};

/** The kind an order takes when saved from each child tab. */
export const LABO_CHILD_KIND: Record<LaboChildKind, LaboOrderKind> = {
  "continue-process": LABO_ORDER_KIND.ContinueStage,
  warranty: LABO_ORDER_KIND.Guarantee,
};

export function isLaboModalKey(value: string | null): value is LaboModalKey {
  return LABO_MODAL_KEYS.some((key) => key === value);
}
