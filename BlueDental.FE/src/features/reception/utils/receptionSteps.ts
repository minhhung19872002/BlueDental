import { t } from "@/lib/i18n";
import type { ReceptionItem } from "../types/reception";
import { isCancelledVisit, type StepAction } from "./receptionFlow";
import type { WaitLevel, WaitState } from "./waitTime";

export interface StepView {
  key: string;
  /** Shown in the circle until the step is done. */
  number: number;
  label: string;
  time?: string;
  /** Muted text after the time: how long the patient waited for the chair. */
  note?: string;
  done: boolean;
  /** The step the patient is waiting for: a dashed circle in the wait colour. */
  pending?: boolean;
  /** Circle, and the line leading into it, once done. */
  color: string;
  labelColor?: string;
  icon: "check" | "cross";
  /** The transition clicking the step makes, when it is the next one. */
  action?: StepAction;
  /** The transition clicking it makes once done: the step taken back. */
  undo?: StepAction;
  /** Tooltip on a done step that a click takes back. */
  undoHint?: string;
}

const STEP_COLORS = ["#6366f1", "#d98b0f", "#0e9f6e"] as const;
const CANCEL_COLOR = "#e5484d";
export const IDLE_COLOR = "#e7eaf6";
export const WAIT_COLORS: Record<WaitLevel, string> = {
  normal: "var(--bd-green)",
  warning: "var(--bd-amber)",
  overdue: "var(--bd-red)",
};

/**
 * The steps the bar shows.
 *
 * Normally Đã đến → Đang khám → Hoàn tất. A revisit booked before the chair
 * ends at step 2, relabelled "Đã hẹn lại"; one booked after it relabels
 * step 3.
 *
 * A cancelled visit (BA) keeps the steps it really went through and ends on a
 * red "Hủy hẹn" with the time it was cancelled — a lone "Hủy hẹn" when the
 * patient never came. "Đã hẹn lại" is not a step it went through, so the
 * cancellation takes its place.
 *
 * While the patient waits, "Đang khám" turns into a dashed circle in the wait
 * colour; once they are in the chair it notes how long they waited.
 */
export function buildSteps(item: ReceptionItem, wait: WaitState): StepView[] {
  const step1Done = !!item.step1Time;
  const step2Done = !!item.step2Time;
  const step3Done = !!item.step3Time;
  const isRevisit = item.selectedOutcome === "Revisit";
  const revisitAtStep2 = isRevisit && step2Done && !step3Done;
  // A visit closed with "Hẹn tái khám" has its next visit booked on it: its bar stays (R-1143).
  const undoOf = (undo: StepAction, undoHint: string) => (isRevisit ? {} : { undo, undoHint });

  const arrived: StepView = {
    key: "arrived", number: 1, label: t("Reception:StatusArrived"), time: item.step1Time,
    done: step1Done, color: STEP_COLORS[0], icon: "check", action: "check-in",
    undo: "undo-check-in", undoHint: t("Reception:UndoArrivedHint"),
  };
  const inChair: StepView = {
    key: "in-chair", number: 2, label: t("Reception:StepInProgress"), time: item.step2Time,
    done: step2Done, color: STEP_COLORS[1], icon: "check", action: "start",
    ...undoOf("undo-start", t("Reception:UndoStartHint")),
    ...(wait.kind === "waiting" && { color: WAIT_COLORS[wait.level], pending: true }),
    ...(wait.kind === "waited" && { note: t("Reception:WaitedMinutes", wait.minutes) }),
  };

  if (isCancelledVisit(item)) {
    const cancelled: StepView = {
      key: "cancelled", number: 1, label: t("Reception:StatusCancelled"), time: item.cancelTime,
      done: true, color: CANCEL_COLOR, labelColor: CANCEL_COLOR, icon: "cross",
    };
    const walked = [step1Done && arrived, step2Done && !isRevisit && inChair].filter(
      (step): step is StepView => !!step,
    );
    return [...walked, cancelled];
  }

  if (revisitAtStep2) {
    // Booked straight from the wait: the patient never sat down, so no "chờ Np".
    return [arrived, { ...inChair, note: undefined, label: t("Reception:StepRevisit"), labelColor: CANCEL_COLOR }];
  }

  return [
    arrived,
    inChair,
    {
      key: "done", number: 3,
      label: isRevisit ? t("Reception:StepRevisit") : t("Reception:StepComplete"),
      time: item.step3Time, done: step3Done, color: STEP_COLORS[2],
      labelColor: isRevisit ? CANCEL_COLOR : undefined, icon: "check", action: "complete",
      ...undoOf("undo-complete", t("Reception:UndoCompleteHint")),
    },
  ];
}

/**
 * What a click on a step does, if anything. Only the first undone step moves
 * the bar, and only after the one before it.
 *
 * A done step pressed again takes itself back with every step after it:
 * "Hoàn tất" returns the patient to the chair, "Đang khám" to the wait, even
 * from Hoàn tất (owner 2026-11-03, R-1143). "Đã đến" only goes while nothing
 * came after it, so not once the patient is in the chair (owner 2026-10-28,
 * kept on 2026-11-03).
 */
export function clickActionOf(
  step: StepView,
  prev: StepView | undefined,
  next: StepView | undefined,
  canAdvance: boolean,
): StepAction | undefined {
  if (!canAdvance) return undefined;
  if (!step.done) return !prev || prev.done ? step.action : undefined;
  if (step.undo === "undo-check-in" && next?.done) return undefined;
  return step.undo;
}
