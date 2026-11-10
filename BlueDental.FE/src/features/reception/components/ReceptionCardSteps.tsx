import React from "react";
import { Check, RotateCcw, X } from "lucide-react";
import type { ReceptionItem } from "../types/reception";
import type { StepAction } from "../utils/receptionFlow";
import { t } from "@/lib/i18n";
import { IDLE_COLOR, WAIT_COLORS, buildSteps, clickActionOf, isDeskLocked, type StepView } from "../utils/receptionSteps";
import type { WaitState } from "../utils/waitTime";
import { WaitTimerChip } from "./WaitTimerChip";

interface ReceptionCardStepsProps {
  item: ReceptionItem;
  /** Neither cancelled nor marked late: the bar may still move on. */
  canAdvance: boolean;
  /** A doctor's bar: "Đã đến" and "Đang khám" are the front desk's (R-1193). */
  deskStepsLocked: boolean;
  wait: WaitState;
  onAdvance: (action: StepAction) => void;
}

const circleClass = (step: StepView) =>
  ["rc-step-circle", step.done && "rc-step-circle--done", step.pending && "rc-step-circle--pending"]
    .filter(Boolean)
    .join(" ");

const colorVar = (color: string) => ({ "--step-color": color }) as React.CSSProperties;

/** Line into `next`: its colour once the step before it is done. */
const lineColor = (from: StepView, next: StepView) => (from.done ? next.color : IDLE_COLOR);

const stepTitle = (step: StepView, undoing: boolean, deskLocked: boolean) => {
  if (deskLocked) return t("Reception:DeskStepLockedHint");
  return undoing ? step.undoHint : undefined;
};

export function ReceptionCardSteps({ item, canAdvance, deskStepsLocked, wait, onAdvance }: ReceptionCardStepsProps) {
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
        const allowed = clickActionOf(step, prev, next, canAdvance);
        const deskLocked = isDeskLocked(step, allowed, deskStepsLocked);
        const command = deskLocked ? undefined : allowed;
        // A done step that still answers a click takes itself back; hovering it shows so.
        const undoing = !!command && step.done;
        const className = ["rc-step", command && "rc-step--clickable", undoing && "rc-step--undo"]
          .filter(Boolean)
          .join(" ");
        return (
          <React.Fragment key={step.key}>
            {index === 1 && waitGap}
            <button
              type="button"
              disabled={!command}
              className={className}
              title={stepTitle(step, undoing, deskLocked)}
              onClick={command ? () => onAdvance(command) : undefined}
            >
              <div className="rc-step-track">
                {prev ? (
                  <div className="rc-step-line" style={{ background: lineColor(prev, step) }} />
                ) : (
                  <div className="rc-step-line rc-step-line--invisible" />
                )}
                <div className={circleClass(step)} style={colorVar(step.color)}>
                  {step.done ? (step.icon === "cross" ? <X size={14} /> : <Check size={14} className="rc-step-check" />) : step.number}
                  {undoing && <RotateCcw size={13} className="rc-step-undo-icon" aria-hidden />}
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
