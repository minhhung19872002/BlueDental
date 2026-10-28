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

const timeOf = (iso: string | undefined) => (iso ? Date.parse(iso) : 0);

/** In the chair: the one who sat down last on top, whoever their doctor (BA, R-979). */
const latestStartFirst = (a: ReceptionItem, b: ReceptionItem) =>
  a.status === "InProgress" ? timeOf(b.startedAt) - timeOf(a.startedAt) : 0;

/** Tab "Hoàn thành": the one finished last on top (BA, R-1066). */
const latestFinishFirst = (a: ReceptionItem, b: ReceptionItem) => timeOf(b.completedAt) - timeOf(a.completedAt);

/**
 * The board's cards: "Đang khám" first, newest start on top, and "Hoàn tất"
 * last, across the whole board. Elsewhere the server's order — start time —
 * holds, since the sort is stable. Only the "Hoàn thành" tab puts the newest
 * finish on top; the finished cards at the foot of "Tất cả" and the "Đã đến"
 * tab keep start time (owner, 2026-10-28). (The doctors' "Mức độ ưu tiên" no
 * longer groups several picked doctors: TEMP-PRIORITY-OFF, owner 2026-10-17.)
 */
export function orderForBoard(items: ReceptionItem[], tab: ReceptionStatus): ReceptionItem[] {
  const withinStep = tab === "Completed" ? latestFinishFirst : latestStartFirst;
  return [...items].sort((a, b) => rankOf(a) - rankOf(b) || withinStep(a, b));
}
