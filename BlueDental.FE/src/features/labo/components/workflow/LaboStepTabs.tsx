import { Check, Lock } from "lucide-react";
import { t } from "@/lib/i18n";
import { LABO_STEP_COPY, LABO_STEPS, type LaboStep } from "./laboWorkflowSteps";

interface Props {
  active: LaboStep;
  isOpen: (step: LaboStep) => boolean;
  /** A step the order is past: a green tick in place of its number. */
  isDone: (step: LaboStep) => boolean;
  onChange: (step: LaboStep) => void;
}

/**
 * 1 Đặt hàng · 2 Nhận hàng & kiểm tra · 3 Bảo hành — a step the order has not
 * reached carries 🔒, one it is past a green tick (Labo 1–3 mocks); the rule
 * between two finished steps turns green too.
 */
export function LaboStepTabs({ active, isOpen, isDone, onChange }: Props) {
  return (
    <div className="pd-labo-steps" role="tablist">
      {LABO_STEPS.map((step, index) => {
        const open = isOpen(step);
        const current = step === active;
        const done = isDone(step);
        const previous = LABO_STEPS[index - 1];
        const joined = done && previous !== undefined && isDone(previous);
        return (
          <button
            key={step}
            type="button"
            role="tab"
            aria-selected={current}
            disabled={!open}
            className={[
              "pd-labo-step",
              current && "pd-labo-step--active",
              done && !current && "pd-labo-step--done",
              joined && "pd-labo-step--joined",
            ]
              .filter(Boolean)
              .join(" ")}
            onClick={() => onChange(step)}
          >
            <span className="pd-labo-step-no">
              {done && !current ? <Check size={12} strokeWidth={3} aria-hidden /> : index + 1}
            </span>
            {t(LABO_STEP_COPY[step].label)}
            {!open && <Lock size={12} aria-hidden />}
          </button>
        );
      })}
    </div>
  );
}
