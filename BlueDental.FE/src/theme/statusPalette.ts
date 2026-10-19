/**
 * The one status palette.
 *
 * Design system v3 (R-988): each state takes four steps — a *-subtle fill, a
 * *-border hairline, a *-solid dot/edge and a *-content text that passes 4.5:1
 * on its fill. Grape is Đã hẹn, mint Đã đến, peach Hủy hẹn, rose Trễ hẹn,
 * orchid Lịch tạm (owner) and sky Chuyển đổi. A cancelled appointment stays the
 * warning colour and a late one the danger colour, as in v2.
 *
 * Five components used to carry their own copy of these triplets and had
 * drifted apart. Anything that draws a status chip reads them from here; a
 * screen that reads a state its own way (a cancellation in red) picks the
 * tone by name.
 */

export type StatusKey =
  | "scheduled"
  | "arrived"
  | "cancelled"
  | "late"
  | "temporary"
  | "converted";

export type ToneName = "grape" | "success" | "warning" | "danger" | "orchid" | "info";

/** The *-solid step of each tone: dot, card left border, calendar block edge. */
export const SOLID: Record<ToneName, string> = {
  grape: "#7b2ef0",
  success: "#2e8a5e",
  warning: "#b4691a",
  danger: "#c9455a",
  orchid: "#9c5caf",
  info: "#2f78b5",
} as const;

/** The *-subtle fill, the *-border hairline and the *-content text. */
export interface StatusTone {
  bg: string;
  border: string;
  color: string;
}

export const TONE: Record<ToneName, StatusTone> = {
  grape: { bg: "#eee5ff", border: "#c4a3ff", color: "#6620cc" },
  success: { bg: "#e3f6ec", border: "#9fddbc", color: "#23704b" },
  warning: { bg: "#fff1de", border: "#f8c98a", color: "#8f5212" },
  danger: { bg: "#fde7ea", border: "#f4a9b4", color: "#a33447" },
  orchid: { bg: "#f6ebfc", border: "#ddb6f2", color: "#834596" },
  info: { bg: "#e2f0fc", border: "#9cc9ee", color: "#255f90" },
} as const;

export const STATUS_COLOR: Record<StatusKey, string> = {
  scheduled: SOLID.grape,
  arrived: SOLID.success,
  cancelled: SOLID.warning,
  late: SOLID.danger,
  temporary: SOLID.orchid,
  converted: SOLID.info,
};

export const STATUS_TONE: Record<StatusKey, StatusTone> = {
  scheduled: TONE.grape,
  arrived: TONE.success,
  cancelled: TONE.warning,
  late: TONE.danger,
  temporary: TONE.orchid,
  converted: TONE.info,
};
