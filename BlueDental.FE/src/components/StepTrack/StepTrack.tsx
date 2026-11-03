import { Check } from "lucide-react";
import "./StepTrack.css";

export type StepState = "done" | "current" | "todo";

export interface StepTrackItem {
  key: string;
  label: string;
  /** The line under the label: a time, "Đang thực hiện", or "—". */
  caption?: string;
  state: StepState;
}

interface Props {
  items: readonly StepTrackItem[];
  /** Names the list for a screen reader. */
  label: string;
  className?: string;
}

/**
 * A numbered dot per step, joined by a rule, with the label (and a caption)
 * under each dot — the P2610 receipt journey. A done step shows ✓ and colours
 * the rule leading out of it.
 */
export function StepTrack({ items, label, className }: Props) {
  return (
    <ol className={["step-track", className].filter(Boolean).join(" ")} aria-label={label}>
      {items.map((item, index) => (
        <li
          key={item.key}
          className={`step-track-item step-track-item--${item.state}`}
          aria-current={item.state === "current" ? "step" : undefined}
        >
          <span className="step-track-dot">
            {item.state === "done" ? <Check size={14} strokeWidth={3} aria-hidden="true" /> : index + 1}
          </span>
          <span className="step-track-label">{item.label}</span>
          {item.caption !== undefined && <span className="step-track-caption">{item.caption}</span>}
        </li>
      ))}
    </ol>
  );
}
