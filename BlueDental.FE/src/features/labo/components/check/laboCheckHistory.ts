import { t } from "@/lib/i18n";
import {
  LABO_ROUND_OUTCOME,
  LABO_TOOTH_RESULT,
  type LaboOrderDto,
  type LaboOrderRoundDto,
  type LaboToothResult,
} from "@/features/labo/api/laboApi";
import { isReturnRound, pickOf, shownReturnCount, toothKey, type LaboTone, type LaboToothPicks } from "./laboCheckRules";

/** One row of Lịch sử nhận hàng & trả hàng · theo răng (P3110 m189, m294). */
export interface LaboToothHistoryRow {
  key: string;
  roundNo: number;
  receivedAt: string;
  /** Rows of the round under the first one: the Lần · ngày cell spans them. */
  span: number;
  /** The open round as picked on screen, not saved yet (m294 tints it). */
  live: boolean;
  roundTally: { label: string; tone: LaboTone };
  tooth: number;
  result: LaboToothResult;
  note?: string | null;
  action: { label: string; tone: LaboTone };
  redeliveryDueAt?: string | null;
}

/** The check on screen, folded into the history as "đang nhập" before it is saved. */
export interface LaboLiveCheck {
  teeth: number[];
  picks: LaboToothPicks | undefined;
  redeliveryDueAt?: string;
}

interface ToothLine {
  tooth: number;
  result: LaboToothResult;
  note?: string | null;
}

function roundTally(lines: ToothLine[], live: boolean): { label: string; tone: LaboTone } {
  const passed = lines.filter((line) => line.result === LABO_TOOTH_RESULT.Passed).length;
  const failed = lines.filter((line) => line.result === LABO_TOOTH_RESULT.Failed).length;
  const base =
    passed === lines.length
      ? { label: t("Labo:Check:History:AllPassed"), tone: "pass" as const }
      : failed === lines.length
        ? { label: t("Labo:Check:History:AllFailed"), tone: "fail" as const }
        : { label: t("Labo:Check:Tally", passed, failed), tone: "warn" as const };
  return live ? { ...base, label: t("Labo:Check:History:Live", base.label) } : base;
}

/** Xử lý: "Trả lần k" for a Lỗi tooth, "Chờ lắp" / "Đã lắp" once Đạt, "—" while unpicked. */
function lineAction(order: LaboOrderDto, round: LaboOrderRoundDto | undefined, line: ToothLine, returnNo: number) {
  if (line.result === LABO_TOOTH_RESULT.Failed) return { label: t("Labo:Check:History:ReturnNo", returnNo), tone: "fail" as const };
  if (line.result !== LABO_TOOTH_RESULT.Passed) return { label: "—", tone: "muted" as const };
  if (round?.outcome === LABO_ROUND_OUTCOME.ReturnedAll) return { label: t("Labo:Check:Outcome:ReturnedAll"), tone: "muted" as const };
  const fitted = order.teeth.find((tooth) => tooth.toothNumber === line.tooth)?.warrantyActivatedAt;
  return { label: t(fitted ? "Labo:Check:History:Fitted" : "Labo:Check:History:AwaitFit"), tone: "ink" as const };
}

/**
 * One row per tooth per delivery, oldest first; the open round shows the picks
 * on screen. "Trả lần k" counts that tooth's own Lỗi returns, not the order's.
 */
export function toothHistoryRows(order: LaboOrderDto, live: LaboLiveCheck | null): LaboToothHistoryRow[] {
  const returnsSoFar = new Map<number, number>();
  return order.rounds.flatMap((round) => {
    const isLive = live !== null && round.outcome === LABO_ROUND_OUTCOME.Pending;
    const lines: ToothLine[] = isLive
      ? live.teeth.map((tooth) => ({ tooth, result: pickOf(live.picks, tooth) ?? LABO_TOOTH_RESULT.None, note: live.picks?.[toothKey(tooth)]?.note }))
      : round.toothResults.map(({ toothNumber, result, note }) => ({ tooth: toothNumber, result, note }));
    const tally = roundTally(lines, isLive);
    const countsAsReturn = isLive || isReturnRound(round);
    return lines.map((line, index) => {
      const failed = line.result === LABO_TOOTH_RESULT.Failed && countsAsReturn;
      const returnNo = (returnsSoFar.get(line.tooth) ?? 0) + 1;
      if (failed) returnsSoFar.set(line.tooth, returnNo);
      return {
        key: `${round.roundNo}:${line.tooth}`,
        roundNo: round.roundNo,
        receivedAt: round.receivedAt,
        span: index === 0 ? lines.length : 0,
        live: isLive,
        roundTally: tally,
        tooth: line.tooth,
        result: line.result,
        note: line.result === LABO_TOOTH_RESULT.Failed ? line.note : null,
        action: lineAction(order, isLive ? undefined : round, line, returnNo),
        redeliveryDueAt: failed ? (isLive ? live.redeliveryDueAt : round.redeliveryDueAt) : null,
      };
    });
  });
}

/** Right of the history title: "1 lần nhận · 0 lần trả", or each tooth's Đã trả once any went back (m294). */
export function historyAside(order: LaboOrderDto, live: LaboLiveCheck | null): string {
  const failingNow = (tooth: number) =>
    live !== null && live.teeth.includes(tooth) && pickOf(live.picks, tooth) === LABO_TOOTH_RESULT.Failed;
  const counts = order.teeth
    .map((tooth) => ({ tooth: tooth.toothNumber, count: shownReturnCount(tooth, failingNow(tooth.toothNumber)) }))
    .filter(({ count }) => count > 0);
  if (counts.length === 0) return t("Labo:Check:History:Count", order.rounds.length, 0);
  const list = counts.map(({ tooth, count }) => t("Labo:Check:History:ToothCount", tooth, count)).join(" · ");
  return t("Labo:Check:History:Returned", order.rounds.length, list);
}
