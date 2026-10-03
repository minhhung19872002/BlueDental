import React from "react";
import { Check, X } from "lucide-react";
import { t } from "@/lib/i18n";
import type { ReceptionItem } from "../types/reception";
import type { WaitLevel, WaitState } from "../utils/waitTime";
import { WaitTimerChip } from "./WaitTimerChip";

type StepAction = "check-in" | "start" | "complete";

interface ReceptionCardStepsProps {
  item: ReceptionItem;
  /** Neither cancelled nor marked late: the bar may still move on. */
  canAdvance: boolean;
  wait: WaitState;
  onAdvance: (action: StepAction) => void;
}

interface StepView {
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
}

const STEP_COLORS = ["#6366f1", "#d98b0f", "#0e9f6e"] as const;
const CANCEL_COLOR = "#e5484d";
const IDLE_COLOR = "#e7eaf6";
const WAIT_COLORS: Record<WaitLevel, string> = {
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
function buildSteps(item: ReceptionItem, wait: WaitState): StepView[] {
  const step1Done = !!item.step1Time;
  const step2Done = !!item.step2Time;
  const step3Done = !!item.step3Time;
  const isRevisit = item.selectedOutcome === "Revisit";
  const revisitAtStep2 = isRevisit && step2Done && !step3Done;

  const arrived: StepView = {
    key: "arrived", number: 1, label: t("Reception:StatusArrived"), time: item.step1Time,
    done: step1Done, color: STEP_COLORS[0], icon: "check", action: "check-in",
  };
  const inChair: StepView = {
    key: "in-chair", number: 2, label: t("Reception:StepInProgress"), time: item.step2Time,
    done: step2Done, color: STEP_COLORS[1], icon: "check", action: "start",
    ...(wait.kind === "waiting" && { color: WAIT_COLORS[wait.level], pending: true }),
    ...(wait.kind === "waited" && { note: t("Reception:WaitedMinutes", wait.minutes) }),
  };

  if (item.counterStatus === "Cancelled") {
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

const circleClass = (step: StepView) =>
  ["rc-step-circle", step.done && "rc-step-circle--done", step.pending && "rc-step-circle--pending"]
    .filter(Boolean)
    .join(" ");

const colorVar = (color: string) => ({ "--step-color": color }) as React.CSSProperties;

/** Line into `next`: its colour once the step before it is done. */
const lineColor = (from: StepView, next: StepView) => (from.done ? next.color : IDLE_COLOR);

export function ReceptionCardSteps({ item, canAdvance, wait, onAdvance }: ReceptionCardStepsProps) {
  const steps = buildSteps(item, wait);
  // Its own column on the line into "Đang khám", so the circles make room for it.
  const waitGap = wait.kind === "waiting" && (
    <div className="rc-wait-gap" style={colorVar(WAIT_COLORS[wait.level])}>
      <WaitTimerChip level={wait.level} elapsedSeconds={wait.elapsedSeconds} />
    </div>
  );

  return (
    <div className={`rc-steps${waitGap ? " rc-steps--waiting" : ""}`}>
      {steps.map((step, index) => {
        const prev = steps[index - 1];
        const next = steps[index + 1];
        // Only the first undone step moves the bar, and only after the one before it.
        const clickable = canAdvance && !!step.action && !step.done && (!prev || prev.done);
        return (
          <React.Fragment key={step.key}>
            {index === 1 && waitGap}
            <button
              type="button"
              disabled={!clickable}
              className={`rc-step ${clickable ? "rc-step--clickable" : ""}`}
              onClick={clickable && step.action ? () => onAdvance(step.action!) : undefined}
            >
              <div className="rc-step-track">
                {prev ? (
                  <div className="rc-step-line" style={{ background: lineColor(prev, step) }} />
                ) : (
                  <div className="rc-step-line rc-step-line--invisible" />
                )}
                <div className={circleClass(step)} style={colorVar(step.color)}>
                  {step.done ? (step.icon === "cross" ? <X size={14} /> : <Check size={14} />) : step.number}
                </div>
                {next ? (
                  <div className="rc-step-line" style={{ background: lineColor(step, next) }} />
                ) : (
                  <div className="rc-step-line rc-step-line--invisible" />
                )}
              </div>
              <p
                className="rc-step-label"
                style={step.labelColor ? { color: step.labelColor } : step.done ? { color: step.color } : undefined}
              >
                {step.label}
              </p>
              <p className="rc-step-time">
                {step.time || "--:--"}
                {step.note && <span className="rc-step-note"> · {step.note}</span>}
              </p>
            </button>
          </React.Fragment>
        );
      })}
    </div>
  );
}
