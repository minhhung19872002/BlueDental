import { useEffect, useMemo, useState } from "react";
import { Button, Modal } from "antd";
import {
  DentitionRadio,
  TOOTH_SURFACES,
  ToothChart,
  dentitionOf,
  type Dentition,
  type ToothPick,
} from "@/components/ToothChart";
import { t } from "@/lib/i18n";
import type { ToothSelectionDto } from "@/features/treatment-management/api/consultingApi";

interface Props {
  open: boolean;
  /** The teeth this công đoạn may take, with the surfaces its line picked. */
  candidates: ToothSelectionDto[];
  /** Tooth codes picked so far. */
  picked: number[];
  /** A continued công đoạn keeps its teeth: the chart is only for looking. */
  locked: boolean;
  onConfirm: (codes: number[]) => void;
  onClose: () => void;
}

/** A line's tooth as the chart draws it: the whole tooth, or its surfaces. */
function toPick(tooth: ToothSelectionDto): ToothPick {
  return {
    fdi: tooth.toothCode,
    surfaces: tooth.selected ? [] : TOOTH_SURFACES.filter((surface) => tooth[surface]),
  };
}

/**
 * The tooth chart behind a công đoạn's Răng row — a BlueDental addition the
 * project owner asked for (the reference shows the chips only), laid out like
 * the reference's "Chọn răng".
 *
 * It follows the form's rules rather than the picker's: only the teeth the
 * công đoạn may take can be clicked — every other tooth is greyed out, so it is
 * plain which of the line's teeth are in play — and each picked tooth shows the
 * surfaces its service line recorded, read-only, since a công đoạn inherits
 * them. On a continued công đoạn nothing can be clicked at all.
 */
export function StageTeethDialog({ open, candidates, picked, locked, onConfirm, onClose }: Props) {
  const [draft, setDraft] = useState<number[]>(picked);
  const [dentition, setDentition] = useState<Dentition>("permanent");

  const byCode = useMemo(
    () => new Map(candidates.map((tooth) => [tooth.toothCode, tooth])),
    [candidates],
  );
  const enabled = useMemo(
    () => new Set(locked ? [] : candidates.map((tooth) => tooth.toothCode)),
    [candidates, locked],
  );

  useEffect(() => {
    if (!open) return;
    setDraft(picked);
    setDentition(dentitionOf(candidates.map(toPick)));
  }, [open, picked, candidates]);

  const value = draft.flatMap((code) => {
    const tooth = byCode.get(code);
    return tooth ? [toPick(tooth)] : [];
  });

  const toggle = (code: number) => {
    if (!enabled.has(code)) return;
    setDraft((current) =>
      current.includes(code) ? current.filter((item) => item !== code) : [...current, code],
    );
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      width="min(1024px, calc(100vw - 32px))"
      className="pd-stage-chartdialog"
      title={t("Treatment:Tooth:ToothPicker")}
      footer={
        locked ? (
          <Button onClick={onClose}>{t("Common:Close")}</Button>
        ) : (
          <Button type="primary" onClick={() => onConfirm(draft)}>
            {t("Treatment:Tooth:ToothPicker")}
          </Button>
        )
      }
      destroyOnHidden
    >
      <div className="pd-stage-charthead">
        <p>{locked ? t("Patient:Stage:ChartLockedHint") : t("Patient:Stage:ChartHint")}</p>
        <DentitionRadio value={dentition} onChange={setDentition} />
      </div>
      <div className="pd-stage-chart">
        <ToothChart
          value={value}
          dentition={dentition}
          enabledTeeth={enabled}
          surfacesReadOnly
          onToggleTooth={toggle}
          onToggleSurface={toggle}
        />
      </div>
    </Modal>
  );
}
