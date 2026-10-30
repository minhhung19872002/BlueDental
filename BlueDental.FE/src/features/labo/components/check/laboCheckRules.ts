import { t } from "@/lib/i18n";
import {
  LABO_ROUND_OUTCOME,
  LABO_STATUS,
  LABO_TOOTH_RESULT,
  type LaboOrderDto,
  type LaboOrderRoundDto,
  type LaboRoundOutcome,
  type LaboToothResult,
} from "@/features/labo/api/laboApi";
import { LABO_PILL_TONE, type LaboPill } from "@/features/labo/api/laboStatus";

/** Nhận hàng and the check are open while the order is at the Labo or waits for its check. */
const CHECKING = new Set<number>([LABO_STATUS.Sent, LABO_STATUS.AwaitingCheck, LABO_STATUS.Returned]);

export function isCheckOpen(order: LaboOrderDto): boolean {
  return CHECKING.has(order.status);
}

/** The round received and not checked yet, if there is one. */
export function openRound(order: LaboOrderDto): LaboOrderRoundDto | undefined {
  const latest = order.rounds.at(-1);
  return order.status === LABO_STATUS.AwaitingCheck && latest?.outcome === LABO_ROUND_OUTCOME.Pending
    ? latest
    : undefined;
}

/** "Nhận hàng · lần N": the open round, or the next one. */
export function receiveRoundNo(order: LaboOrderDto): number {
  return openRound(order)?.roundNo ?? order.rounds.length + 1;
}

/**
 * The teeth this check covers: every one not Đạt yet. A Trả hàng bị lỗi keeps
 * the passed teeth passed; a Trả toàn bộ reopened them, so they are back here.
 */
export function dueTeeth(order: LaboOrderDto): number[] {
  return order.teeth
    .filter((tooth) => tooth.checkResult !== LABO_TOOTH_RESULT.Passed)
    .map((tooth) => tooth.toothNumber);
}

export function passedTeeth(order: LaboOrderDto): number[] {
  return order.teeth
    .filter((tooth) => tooth.checkResult === LABO_TOOTH_RESULT.Passed)
    .map((tooth) => tooth.toothNumber);
}

/** One tooth's pick in B. Kiểm tra từng răng. */
export interface LaboToothPick {
  result?: LaboToothResult;
  note?: string;
}

export type LaboToothPicks = Record<string, LaboToothPick | undefined>;

/** The form key of a tooth: a letter first, so the field store builds an object, not an array. */
export const toothKey = (tooth: number) => `t${tooth}`;

export type LaboCheckVerdict = "incomplete" | "pass" | "return";

/** Every due tooth Đạt → Xác nhận Labo đạt; any Lỗi → the two Trả buttons. */
export function checkVerdict(teeth: number[], picks: LaboToothPicks | undefined): LaboCheckVerdict {
  const results = teeth.map((tooth) => picks?.[toothKey(tooth)]?.result);
  if (results.some((result) => result === LABO_TOOTH_RESULT.Failed)) return "return";
  if (results.length > 0 && results.every((result) => result === LABO_TOOTH_RESULT.Passed)) return "pass";
  return "incomplete";
}

/** "Răng 21: Lệch màu, Hở bờ. Ảnh kiểm tra đính kèm." — Mô tả gửi Labo as first filled. */
export function composeDescription(teeth: number[], picks: LaboToothPicks | undefined): string {
  const lines = teeth
    .filter((tooth) => picks?.[toothKey(tooth)]?.result === LABO_TOOTH_RESULT.Failed)
    .map((tooth) => {
      const note = picks?.[toothKey(tooth)]?.note?.trim();
      return note ? t("Labo:Check:ToothDefect", tooth, note) : t("Labo:Check:ToothDefectBare", tooth);
    });
  return lines.length > 0 ? [...lines, t("Labo:Check:PicturesAttached")].join(" ") : "";
}

/** The Lỗi column of the history: each failed tooth with its note. */
export function roundDefects(round: LaboOrderRoundDto): string {
  return round.toothResults
    .filter((tooth) => tooth.result === LABO_TOOTH_RESULT.Failed)
    .map((tooth) =>
      tooth.note?.trim()
        ? t("Labo:Check:ToothDefect", tooth.toothNumber, tooth.note.trim())
        : t("Labo:Check:ToothDefectBare", tooth.toothNumber),
    )
    .join(" ");
}

/** Kết quả of a round in the history table. */
export const LABO_ROUND_OUTCOME_PILL: Record<LaboRoundOutcome, LaboPill> = {
  [LABO_ROUND_OUTCOME.Pending]: { label: "Labo:Check:Outcome:Pending", ...LABO_PILL_TONE.warning },
  [LABO_ROUND_OUTCOME.Passed]: { label: "Labo:Check:Outcome:Passed", ...LABO_PILL_TONE.success },
  [LABO_ROUND_OUTCOME.ReturnedAll]: { label: "Labo:Check:Outcome:ReturnedAll", ...LABO_PILL_TONE.danger },
  [LABO_ROUND_OUTCOME.ReturnedDefective]: { label: "Labo:Check:Outcome:ReturnedDefective", ...LABO_PILL_TONE.danger },
};
