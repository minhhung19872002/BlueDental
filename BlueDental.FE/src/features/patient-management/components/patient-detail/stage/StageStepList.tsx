import { Checkbox } from "antd";
import { t } from "@/lib/i18n";

interface Step {
  id: string;
  name: string;
}

interface Props {
  /** The steps the service declares, in its own order. */
  steps: Step[];
  /** Step ids currently ticked. */
  checked: string[];
  /** Omitted while a toggle is in flight, which disables the whole list. */
  onToggle?: (stepId: string, next: boolean) => void;
  busy?: boolean;
}

/**
 * "Danh sách công đoạn" — the service's own steps as checkboxes.
 *
 * Used in two places, which is why it takes its state rather than owning it: on
 * the công đoạn form it picks which steps the công đoạn will cover, and in the
 * treatment history row it ticks them off as they are done. A service that
 * declares no steps prints "(Trống)", the reference's empty state.
 */
export function StageStepList({ steps, checked, onToggle, busy = false }: Props) {
  return (
    <div className="pd-stage-steps">
      <p className="pd-stage-list">{t("Danh sách công đoạn")}</p>
      {steps.length === 0 ? (
        <p className="pd-stage-listempty">{t("(Trống)")}</p>
      ) : (
        <div>
          {steps.map((step) => (
            <Checkbox
              key={step.id}
              checked={checked.includes(step.id)}
              disabled={busy || !onToggle}
              onChange={(event) => onToggle?.(step.id, event.target.checked)}
            >
              {step.name}
            </Checkbox>
          ))}
        </div>
      )}
    </div>
  );
}
