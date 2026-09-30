import React from "react";
import { Check, X } from "lucide-react";
import { t } from "@/lib/i18n";
import type { ReceptionItem } from "../types/reception";

type StepAction = "check-in" | "start" | "complete";

interface ReceptionCardStepsProps {
  item: ReceptionItem;
  /** Neither cancelled nor marked late: the bar may still move on. */
  canAdvance: boolean;
  onAdvance: (action: StepAction) => void;
}

interface StepView {
  key: string;
  /** Shown in the circle until the step is done. */
  number: number;
  label: string;
  time?: string;
  done: boolean;
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
 */
function buildSteps(item: ReceptionItem): StepView[] {
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
    return [arrived, { ...inChair, label: t("Reception:StepRevisit"), labelColor: CANCEL_COLOR }];
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

const circleStyle = (step: StepView): React.CSSProperties => ({
  width: 32,
  height: 32,
  borderRadius: "50%",
  border: `1px solid ${step.done ? step.color : IDLE_COLOR}`,
  background: step.done ? step.color : "#fff",
  color: step.done ? "#fff" : "var(--bd-muted)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 13,
  fontWeight: 600,
  flexShrink: 0,
});

/** Line into `next`: its colour once the step before it is done. */
const lineColor = (from: StepView, next: StepView) => (from.done ? next.color : IDLE_COLOR);

export function ReceptionCardSteps({ item, canAdvance, onAdvance }: ReceptionCardStepsProps) {
  const steps = buildSteps(item);

  return (
    <div className="rc-steps">
      {steps.map((step, index) => {
        const prev = steps[index - 1];
        const next = steps[index + 1];
        // Only the first undone step moves the bar, and only after the one before it.
        const clickable = canAdvance && !!step.action && !step.done && (!prev || prev.done);
        return (
          <button
            key={step.key}
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
              <div style={circleStyle(step)}>
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
            <p className="rc-step-time">{step.time || "--:--"}</p>
          </button>
        );
      })}
    </div>
  );
}
