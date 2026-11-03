import dayjs from "dayjs";
import {
  LABO_ORDER_KIND,
  LABO_STATUS,
  type LaboOrderDto,
  type LaboOrderKind,
  type LaboStatus,
} from "./laboApi";

/** A coloured pill: an i18n key and the StatusBadge colours. */
export interface LaboPill {
  label: string;
  bg: string;
  color: string;
}

/** The tones the Labo pills share, so a status and a kind read alike. */
export const LABO_PILL_TONE = {
  info: { bg: "#e0f2fe", color: "#008af5" },
  success: { bg: "#ecfdf5", color: "#57bc6c" },
  danger: { bg: "#fff1f2", color: "#d57463" },
  purple: { bg: "#f5f3ff", color: "#6c3cf0" },
  warning: { bg: "#fffbeb", color: "#d97706" },
  gray: { bg: "#f7f8fd", color: "#171c33" },
  muted: { bg: "#f1f5f9", color: "#64748b" },
} as const;

/** The BA's seven stored statuses (P2910_03). */
export const LABO_STATUS_CONFIG: Record<LaboStatus, LaboPill> = {
  [LABO_STATUS.Draft]: { label: "Patient:Labo:Status:Draft", ...LABO_PILL_TONE.gray },
  [LABO_STATUS.Sent]: { label: "Patient:Labo:Status:Sent", ...LABO_PILL_TONE.info },
  [LABO_STATUS.AwaitingCheck]: { label: "Patient:Labo:Status:AwaitingCheck", ...LABO_PILL_TONE.warning },
  [LABO_STATUS.Returned]: { label: "Patient:Labo:Status:Returned", ...LABO_PILL_TONE.danger },
  [LABO_STATUS.Completed]: { label: "Patient:Labo:Status:Completed", ...LABO_PILL_TONE.success },
  [LABO_STATUS.Cancelled]: { label: "Patient:Labo:Status:Cancelled", ...LABO_PILL_TONE.muted },
  [LABO_STATUS.Warranty]: { label: "Patient:Labo:Status:Warranty", ...LABO_PILL_TONE.purple },
};

/** "Hết hạn bảo hành" — not stored, read off a Bảo hành order whose every card has run out. */
export const LABO_WARRANTY_EXPIRED_PILL: LaboPill = {
  label: "Patient:Labo:Status:WarrantyExpired",
  ...LABO_PILL_TONE.muted,
};

/** The pill a row shows: its stored status, or Hết hạn bảo hành once every card has run out. */
export function laboStatusPill(order: Pick<LaboOrderDto, "status" | "isWarrantyExpired">): LaboPill {
  return order.isWarrantyExpired ? LABO_WARRANTY_EXPIRED_PILL : LABO_STATUS_CONFIG[order.status];
}

/** Why the sample was sent — only the old child orders are anything but Đặt mới. */
export const LABO_KIND_CONFIG: Record<LaboOrderKind, LaboPill> = {
  [LABO_ORDER_KIND.New]: { label: "Patient:Labo:Sample:New", ...LABO_PILL_TONE.info },
  [LABO_ORDER_KIND.ContinueStage]: { label: "Patient:Labo:Sample:Continue", ...LABO_PILL_TONE.info },
  [LABO_ORDER_KIND.Guarantee]: { label: "Patient:Labo:Sample:Warranty", ...LABO_PILL_TONE.purple },
  [LABO_ORDER_KIND.Canceled]: { label: "Patient:Labo:Status:Cancelled", ...LABO_PILL_TONE.danger },
};

/** At the lab: Đã gửi Labo, or Trả hàng waiting on the next delivery. */
export function isAtLab(status: LaboStatus): boolean {
  return status === LABO_STATUS.Sent || status === LABO_STATUS.Returned;
}

/** The small tag under Gửi → Hẹn giao. */
export type LaboDueTag =
  | { kind: "left"; days: number }
  | { kind: "late"; days: number }
  | { kind: "delivered"; date: string };

/**
 * "còn N ngày" while the order is at the lab and not yet due, red "Trễ N
 * ngày" once it is past due, "đã giao dd/MM" from the latest delivery once
 * something came back. Nháp and Đã hủy carry no tag.
 */
export function laboDueTag(order: LaboOrderDto, today = dayjs()): LaboDueTag | null {
  if (isAtLab(order.status)) {
    if (!order.dueAt) return null;
    const days = dayjs(order.dueAt).startOf("day").diff(today.startOf("day"), "day");
    return days < 0 ? { kind: "late", days: -days } : { kind: "left", days };
  }
  if (order.status === LABO_STATUS.Draft || order.status === LABO_STATUS.Cancelled) return null;
  const delivered = order.rounds.at(-1)?.receivedAt ?? order.receivedAt;
  return delivered ? { kind: "delivered", date: delivered } : null;
}
