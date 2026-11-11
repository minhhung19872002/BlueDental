import { teethCaption, wholeJawOf } from "@/components/ToothChart";
import type { ToothSelectionDto } from "@/features/treatment-management/api/consultingApi";
import { t } from "@/lib/i18n";
import { StageTeethPicker } from "./StageTeethPicker";
import { toothCodes } from "./stageModel";

interface Props {
  /** The teeth this form can take. */
  candidates: ToothSelectionDto[];
  /** Every tooth of the line — what decides whether it is a whole jaw. */
  shown: ToothSelectionDto[];
  picked: number[];
  error?: string;
  onToggle: (code: number) => void;
  onChange: (codes: number[]) => void;
}

/**
 * The Răng line at the head of Nội dung điều trị (owner, 2026-11-11, R-1206).
 * A line booked as a whole jaw — Hai hàm, Hàm trên, Hàm dưới — reads as that
 * name and takes all its teeth: no tooth can be left out of it. A line of
 * single teeth keeps the chips, each one picked or not.
 */
export function StageTeethRow({ candidates, shown, picked, error, onToggle, onChange }: Props) {
  if (shown.length > 0 && wholeJawOf(shown)) {
    // The teeth still open; before a warranty card is picked there are none yet.
    const codes = toothCodes(candidates.length > 0 ? candidates : shown).sort((a, b) => a - b);
    return (
      <>
        <div className="pd-stage-teeth pd-stage-teeth--jaw">
          <p>
            {t("Patient:DentalChart:Tooth")}: <strong>{teethCaption(codes, String)}</strong>
          </p>
        </div>
        {error && <p className="pd-stage-error">{error}</p>}
      </>
    );
  }

  return (
    <>
      <StageTeethPicker
        candidates={candidates}
        shown={shown}
        picked={picked}
        locked={false}
        error={error}
        onToggle={onToggle}
        onChange={onChange}
      />
      {error && <p className="pd-stage-error">{error}</p>}
    </>
  );
}
