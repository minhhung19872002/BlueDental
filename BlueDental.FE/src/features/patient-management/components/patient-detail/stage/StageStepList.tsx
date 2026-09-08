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
  /**
   * How the step names are drawn. The reference prints them plain on a form
   * and bold-primary on the read-only "Tạo tái khám" rows.
   */
  tone?: "plain" | "accent";
}

/**
 * "Danh sách công đoạn" — a list of steps as checkboxes.
 *
 * Used wherever that heading appears, which is why it takes its state rather
 * than owning it: on the công đoạn form it picks which of the service's steps
 * the công đoạn will cover, in the treatment history row it ticks them off as
 * they are done, and on the tái khám screens it carries the single synthesised
 * entry from {@link reExaminationChecklist}. An empty list prints "(Trống)",
 * the reference's own empty state.
 */
export function StageStepList({
  steps,
  checked,
  onToggle,
  busy = false,
  tone = "plain",
}: Props) {
  return (
    <div className={tone === "accent" ? "pd-stage-steps pd-stage-steps--accent" : "pd-stage-steps"}>
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
