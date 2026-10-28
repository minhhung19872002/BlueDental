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
  /** The transition clicking it makes once done and last: "Đã đến" taken back. */
  undo?: StepAction;
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

  const arrived: StepView = {
    key: "arrived", number: 1, label: t("Reception:StatusArrived"), time: item.step1Time,
    done: step1Done, color: STEP_COLORS[0], icon: "check", action: "check-in", undo: "undo-check-in",
  };
  const inChair: StepView = {
    key: "in-chair", number: 2, label: t("Reception:StepInProgress"), time: item.step2Time,
    done: step2Done, color: STEP_COLORS[1], icon: "check", action: "start",
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
    },
  ];
}

/**
 * What a click on a step does, if anything. Only the first undone step moves
 * the bar, and only after the one before it. "Đã đến" pressed by mistake is
 * pressed again to take it back — only while nothing came after it, so not
 * once the patient is in the chair (owner 2026-10-28).
 */
export function clickActionOf(
  step: StepView,
  prev: StepView | undefined,
  next: StepView | undefined,
  canAdvance: boolean,
): StepAction | undefined {
  if (!canAdvance) return undefined;
  if (!step.done) return !prev || prev.done ? step.action : undefined;
  return next?.done ? undefined : step.undo;
}
