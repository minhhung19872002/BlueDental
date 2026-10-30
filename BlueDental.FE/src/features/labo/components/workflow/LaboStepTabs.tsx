import { Lock } from "lucide-react";
import { t } from "@/lib/i18n";
import { LABO_STEP_COPY, LABO_STEPS, type LaboStep } from "./laboWorkflowSteps";

interface Props {
  active: LaboStep;
  isOpen: (step: LaboStep) => boolean;
  onChange: (step: LaboStep) => void;
}

/** 1 Đặt hàng · 2 Nhận hàng & kiểm tra · 3 Bảo hành — a step the order has not reached carries 🔒. */
export function LaboStepTabs({ active, isOpen, onChange }: Props) {
  return (
    <div className="pd-labo-steps" role="tablist">
      {LABO_STEPS.map((step, index) => {
        const open = isOpen(step);
        return (
          <button
            key={step}
            type="button"
            role="tab"
            aria-selected={step === active}
            disabled={!open}
            className={["pd-labo-step", step === active && "pd-labo-step--active"].filter(Boolean).join(" ")}
            onClick={() => onChange(step)}
          >
            <span className="pd-labo-step-no">{index + 1}</span>
            {t(LABO_STEP_COPY[step].label)}
            {!open && <Lock size={12} aria-hidden />}
          </button>
        );
      })}
    </div>
  );
}
