import type { ReactNode } from "react";

interface FollowUpStepHeadProps {
  index: number;
  title: string;
  hint?: string;
  /** Pushed to the right edge: the month and week arrows of step 2. */
  aside?: ReactNode;
}

/** The numbered heading of each step in "Chọn lịch hẹn tiếp theo". */
export function FollowUpStepHead({ index, title, hint, aside }: FollowUpStepHeadProps) {
  return (
    <div className="fu-step-head">
      <div className="fu-step-title">
        <span className="fu-step-num" aria-hidden>{index}</span>
        <h5 className="fu-step-label">{title}</h5>
        {hint && <span className="fu-step-hint">{hint}</span>}
      </div>
      {aside}
    </div>
  );
}
