import { t } from "@/lib/i18n";
import {
  LABO_ROUND_OUTCOME,
  LABO_STATUS,
  LABO_TOOTH_RESULT,
  type LaboOrderDto,
  type LaboOrderImageDto,
  type LaboOrderRoundDto,
  type LaboOrderToothDto,
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

/** A saved Ảnh kiểm tra of a tooth found Đạt in its round (P0111_02, R-1110), not a Hình ảnh lỗi. */
export function isPassedToothPicture(order: LaboOrderDto, image: LaboOrderImageDto): boolean {
  const round = order.rounds.find((r) => r.roundNo === image.roundNo);
  return (
    round?.toothResults.some((r) => r.toothNumber === image.toothNumber && r.result === LABO_TOOTH_RESULT.Passed) ??
    false
  );
}

const RETURNED = new Set<number>([LABO_ROUND_OUTCOME.ReturnedAll, LABO_ROUND_OUTCOME.ReturnedDefective]);

export const isReturnRound = (round: LaboOrderRoundDto) => RETURNED.has(round.outcome);

/**
 * The teeth this check covers: every one not Đạt yet. A Trả hàng bị lỗi keeps
 * the passed teeth passed; a Trả toàn bộ reopened them, so they are back here.
 */
export function dueTeeth(order: LaboOrderDto): LaboOrderToothDto[] {
  return order.teeth.filter((tooth) => tooth.checkResult !== LABO_TOOTH_RESULT.Passed);
}

/** Đạt on an earlier delivery: shown greyed, not checked again (P3110 REQ-D7). */
export function passedTeeth(order: LaboOrderDto): LaboOrderToothDto[] {
  return order.teeth.filter((tooth) => tooth.checkResult === LABO_TOOTH_RESULT.Passed);
}

/** One tooth's pick in B. Kiểm tra & kết luận từng răng; the note is its Mô tả gửi Labo. */
export interface LaboToothPick {
  result?: LaboToothResult;
  note?: string;
  /** Mặt bị lỗi picked on the tooth's picture (R-1151): codes among its Mặt răng. */
  faults?: string[];
}

export type LaboToothPicks = Record<string, LaboToothPick | undefined>;

/** The form key of a tooth: a letter first, so the field store builds an object, not an array. */
export const toothKey = (tooth: number) => `t${tooth}`;

export const pickOf = (picks: LaboToothPicks | undefined, tooth: number) => picks?.[toothKey(tooth)]?.result;

export type LaboCheckVerdict = "incomplete" | "pass" | "return";

/** Every due tooth Đạt → Xác nhận Labo đạt; any Lỗi → the Trả buttons. */
export function checkVerdict(teeth: number[], picks: LaboToothPicks | undefined): LaboCheckVerdict {
  const results = teeth.map((tooth) => pickOf(picks, tooth));
  if (results.some((result) => result === LABO_TOOTH_RESULT.Failed)) return "return";
  if (results.length > 0 && results.every((result) => result === LABO_TOOTH_RESULT.Passed)) return "pass";
  return "incomplete";
}

export function failedTeeth(teeth: number[], picks: LaboToothPicks | undefined): number[] {
  return teeth.filter((tooth) => pickOf(picks, tooth) === LABO_TOOTH_RESULT.Failed);
}

export type LaboTone = "pass" | "fail" | "warn" | "muted" | "ink";

/**
 * Right of the B. title (Labo 2 v2 mock, R-1151): "Đạt 1 · Lỗi 1", with
 * "· Chưa đánh giá n" while a tooth has no result — amber once any is Lỗi,
 * green when all are Đạt.
 */
export function teethTally(teeth: number[], picks: LaboToothPicks | undefined): { label: string; tone: LaboTone } {
  const passed = teeth.filter((tooth) => pickOf(picks, tooth) === LABO_TOOTH_RESULT.Passed).length;
  const failed = failedTeeth(teeth, picks).length;
  const pending = teeth.length - passed - failed;
  const label = t("Labo:Check:Tally", passed, failed) + (pending > 0 ? t("Labo:Check:TallyPending", pending) : "");
  if (failed > 0) return { label, tone: "warn" };
  return { label, tone: teeth.length > 0 && passed === teeth.length ? "pass" : "muted" };
}

/** A Lỗi tooth whose Mô tả gửi Labo is still blank: the footer counts them (Labo 2 v2 mock). */
export function undescribedTeeth(teeth: number[], picks: LaboToothPicks | undefined): number[] {
  return failedTeeth(teeth, picks).filter((tooth) => !picks?.[toothKey(tooth)]?.note?.trim());
}

/** The Lỗi notes this tooth went back with, oldest first: "Lần 1: sai khớp cắn · Lần 2: hở bờ" (m342). */
export function returnNotes(order: LaboOrderDto, tooth: number): string[] {
  return order.rounds
    .filter(isReturnRound)
    .map((round) => round.toothResults.find((result) => result.toothNumber === tooth))
    .filter((result) => result?.result === LABO_TOOTH_RESULT.Failed)
    .map((result) => result?.note?.trim() || "—");
}

/** Prefilled into the next check of a tooth that went back (P3110 REQ-D6). */
export function latestReturnNote(order: LaboOrderDto, tooth: number): string | undefined {
  const note = returnNotes(order, tooth).at(-1);
  return note && note !== "—" ? note : undefined;
}

/** The round a tooth last passed on: "Đạt lần k". */
export function passedRoundNo(order: LaboOrderDto, tooth: number): number | undefined {
  return order.rounds
    .filter((round) => round.toothResults.some((r) => r.toothNumber === tooth && r.result === LABO_TOOTH_RESULT.Passed))
    .at(-1)?.roundNo;
}

/** Đã trả n lần: the past returns plus this one when the tooth is Lỗi now (P3110 REQ-D5). */
export const shownReturnCount = (tooth: LaboOrderToothDto, failingNow: boolean) =>
  tooth.returnCount + (failingNow ? 1 : 0);

/** Kết quả of a round in the history table. */
export const LABO_ROUND_OUTCOME_PILL: Record<LaboRoundOutcome, LaboPill> = {
  [LABO_ROUND_OUTCOME.Pending]: { label: "Labo:Check:Outcome:Pending", ...LABO_PILL_TONE.warning },
  [LABO_ROUND_OUTCOME.Passed]: { label: "Labo:Check:Outcome:Passed", ...LABO_PILL_TONE.success },
  [LABO_ROUND_OUTCOME.ReturnedAll]: {
    label: "Labo:Check:Outcome:ReturnedAll",
    ...LABO_PILL_TONE.danger,
  },
  [LABO_ROUND_OUTCOME.ReturnedDefective]: {
    label: "Labo:Check:Outcome:ReturnedDefective",
    ...LABO_PILL_TONE.danger,
  },
};
