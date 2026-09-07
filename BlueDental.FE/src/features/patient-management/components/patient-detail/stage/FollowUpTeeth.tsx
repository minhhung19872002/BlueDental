import { t } from "@/lib/i18n";
import type { ToothSelectionDto } from "@/features/treatment-management/api/consultingApi";

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
}

/**
 * The Răng row of the follow-up form.
 *
 * A tái khám only covers the teeth being seen again, so each chip is a toggle
 * and **none starts ticked** — the reference keeps the source stage's teeth as
 * `content` and the ticked ones as `selectedContent`, printing only the second
 * on the row.
 */
export function FollowUpTeeth({ candidates, picked, onToggle }: Props) {
  return (
    <div className="pd-stage-teeth">
      <p>{t("Răng")}:</p>
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
      </div>
    </div>
  );
}
