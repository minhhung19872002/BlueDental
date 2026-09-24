import { useState } from "react";
import { Tooltip } from "antd";
import { t } from "@/lib/i18n";
import type { ToothSelectionDto } from "@/features/treatment-management/api/consultingApi";
import { StageTeethDialog } from "./StageTeethDialog";

interface Props {
  /** The teeth on offer — numbers only, as the reference prints them. */
  candidates: ToothSelectionDto[];
  picked: number[];
  /** A continued công đoạn keeps its teeth: chips shown, not clickable. */
  locked: boolean;
  error?: string;
  onChange: (codes: number[]) => void;
}

/**
 * The Răng row of a công đoạn form.
 *
 * Measured on staging 2026-09-24 (`InlineTeethSelector`): every tooth on offer
 * is a chip, picked ones filled blue, and a click turns one on or off — so a
 * doctor can take some of a line's teeth into this công đoạn and leave the rest
 * for later. On a continued công đoạn the chips are disabled at 70% opacity.
 * Beside them, the chart button opens {@link StageTeethDialog}.
 */
export function StageTeethPicker({ candidates, picked, locked, error, onChange }: Props) {
  const [charting, setCharting] = useState(false);

  const toggle = (code: number) =>
    onChange(picked.includes(code) ? picked.filter((item) => item !== code) : [...picked, code]);

  return (
    <div className="pd-stage-teeth">
      <p>{t("Patient:DentalChart:Tooth")}:</p>
      <div>
        {candidates.map((tooth) => {
          const on = picked.includes(tooth.toothCode);
          return (
            <button
              type="button"
              key={tooth.toothCode}
              className={[on && "active", error && !on && "pd-stage-tooth--error"]
                .filter(Boolean)
                .join(" ")}
              aria-pressed={on}
              disabled={locked}
              onClick={() => toggle(tooth.toothCode)}
            >
              {tooth.toothCode}
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
        locked={locked}
        onConfirm={(codes) => {
          onChange(codes);
          setCharting(false);
        }}
        onClose={() => setCharting(false)}
      />
    </div>
  );
}
