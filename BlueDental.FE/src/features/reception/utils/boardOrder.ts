import type { ReceptionItem, ReceptionStatus } from "../types/reception";

/**
 * Where a visit's step moves its card (BA, 2026-10-17): in the chair to the
 * top, finished to the bottom. Waiting, late and cancelled visits stay between
 * them, so they need no entry here.
 */
const BOARD_RANK: Partial<Record<ReceptionStatus, number>> = {
  InProgress: -1,
  Completed: 1,
};

const rankOf = (item: ReceptionItem) => BOARD_RANK[item.status] ?? 0;

/**
 * The board's cards: "Đang khám" first, "Hoàn tất" last, across the whole
 * board. Within each, the server's order holds — start time, or the doctors'
 * "Mức độ ưu tiên" when several are picked — since the sort is stable.
 */
export function orderForBoard(items: ReceptionItem[]): ReceptionItem[] {
  return [...items].sort((a, b) => rankOf(a) - rankOf(b));
}
