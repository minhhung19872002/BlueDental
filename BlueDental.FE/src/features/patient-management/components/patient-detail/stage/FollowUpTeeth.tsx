import { useState } from "react";
import { Tooltip } from "antd";
import { t } from "@/lib/i18n";
import type { ToothSelectionDto } from "@/features/treatment-management/api/consultingApi";
import { StageTeethDialog } from "./StageTeethDialog";

interface Props {
  /** The source công đoạn's teeth. */
  candidates: ToothSelectionDto[];
  /** Tooth codes ticked so far; ignored when `onToggle` is absent. */
  picked: number[];
  /**
   * Given for a tái khám, which picks among the teeth; omitted for a warranty
   * visit, which inherits them and so prints them as plain chips.
   */
  onToggle?: (toothCode: number) => void;
  /**
   * The chart's "Chọn răng": the whole pick at once. Without it the chart only
   * shows the teeth.
   */
  onChange?: (toothCodes: number[]) => void;
}

/**
 * The Răng row of the follow-up form.
 *
 * A tái khám only covers the teeth being seen again, so each chip is a toggle
 * and **none starts ticked** — the reference keeps the source stage's teeth as
 * `content` and the ticked ones as `selectedContent`, printing only the second
 * on the row.
 *
 * Beside the chips sits the same chart button as the công đoạn form (a
 * BlueDental addition, as there): the chart greys every tooth the công đoạn
 * does not cover, so the doctor sees where the teeth being seen again sit.
 */
export function FollowUpTeeth({ candidates, picked, onToggle, onChange }: Props) {
  const [charting, setCharting] = useState(false);

  return (
    <div className="pd-stage-teeth">
      <p>{t("Patient:DentalChart:Tooth")}:</p>
      <div>
        {candidates.map((tooth) => {
          const label = String(tooth.toothCode);
          if (!onToggle) {
            return <span key={label}>{label}</span>;
          }
          const on = picked.includes(tooth.toothCode);
          return (
            <button
              type="button"
              key={label}
              className={on ? "active" : undefined}
              aria-pressed={on}
              onClick={() => onToggle(tooth.toothCode)}
            >
              {label}
            </button>
          );
        })}
        <Tooltip title={t("Patient:Stage:ViewChart")}>
          <button
            type="button"
            className="pd-stage-chartbtn"
            aria-label={t("Patient:Stage:ViewChart")}
            onClick={() => setCharting(true)}
          >
            <img src="/img/teeth/teeth.svg" alt="" draggable={false} />
          </button>
        </Tooltip>
      </div>

      <StageTeethDialog
        open={charting}
        candidates={candidates}
        picked={picked}
        locked={!onChange}
        onConfirm={(codes) => {
          onChange?.(codes);
          setCharting(false);
        }}
        onClose={() => setCharting(false)}
      />
    </div>
  );
}
