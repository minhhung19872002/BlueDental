import { useEffect, useState } from "react";
import { Modal } from "antd";
import { X } from "lucide-react";
import {
  DentitionRadio,
  LOWER_TEETH,
  ToothChart,
  ToothPickerTabs,
  UPPER_TEETH,
  dentitionOf,
  toggleSurface,
  toggleTooth,
  type Dentition,
  type JawPreset,
  type ToothPick,
  type ToothSurface,
} from "@/components/ToothChart";
import { t } from "@/lib/i18n";
import type { ToothPickerTab, ToothPickerValue } from "./toothPicker";

interface Props {
  open: boolean;
  value: ToothPickerValue;
  /**
   * Teeth that must stay picked — on an edited line, the ones that already
   * have a công đoạn. Staging refuses to let them go and says why above the
   * chart ("Răng … đang điều trị — không thể bỏ chọn").
   */
  lockedTeeth?: number[];
  onConfirm: (value: ToothPickerValue) => void;
  onClose: () => void;
}

const JAW_TEETH: Record<JawPreset, readonly number[]> = {
  upper: UPPER_TEETH,
  lower: LOWER_TEETH,
  full: [...UPPER_TEETH, ...LOWER_TEETH],
};

/**
 * What confirming hands back once the locked teeth are folded in, the way
 * staging does it: any locked tooth the pick left out is added back whole. A
 * jaw that does not hold them all becomes that jaw's teeth plus the locked.
 */
function withLocked(value: ToothPickerValue, locked: number[]): ToothPickerValue {
  if (locked.length === 0) return value;
  if (value.kind === "jaw") {
    const jaw = JAW_TEETH[value.jaw];
    if (locked.every((fdi) => jaw.includes(fdi))) return value;
    const teeth: ToothPick[] = [...jaw, ...locked.filter((fdi) => !jaw.includes(fdi))].map((fdi) => ({
      fdi,
      surfaces: [],
    }));
    return { kind: "teeth", teeth };
  }
  const missing = locked.filter((fdi) => !value.teeth.some((pick) => pick.fdi === fdi));
  return { kind: "teeth", teeth: [...value.teeth, ...missing.map((fdi) => ({ fdi, surfaces: [] }))] };
}

interface Draft {
  tab: ToothPickerTab;
  dentition: Dentition;
  teeth: ToothPick[];
}

function draftFrom(value: ToothPickerValue): Draft {
  return value.kind === "jaw"
    ? { tab: value.jaw, dentition: "permanent", teeth: [] }
    : { tab: "teeth", dentition: dentitionOf(value.teeth), teeth: value.teeth };
}

/**
 * "Chọn răng": the tab strip, the dentition radios and the surface chart.
 * A jaw tab stands for the whole jaw, so it hides the chart (the dialog
 * collapses to the strip and the button) and drops any individual picks.
 * Reopening starts from the last confirmed value.
 */
export function ToothPickerDialog({ open, value, lockedTeeth = [], onConfirm, onClose }: Props) {
  const [draft, setDraft] = useState<Draft>(() => draftFrom(value));

  useEffect(() => {
    if (open) setDraft(draftFrom(value));
  }, [open, value]);

  const handleTab = (tab: ToothPickerTab) =>
    setDraft((current) => ({ tab, dentition: current.dentition, teeth: [] }));

  // Adult and baby teeth never mix on one slip: swapping the chart drops the picks.
  const handleDentition = (dentition: Dentition) =>
    setDraft((current) => (current.dentition === dentition ? current : { ...current, dentition, teeth: [] }));

  const handleConfirm = () => {
    onConfirm(
      withLocked(
        draft.tab === "teeth" ? { kind: "teeth", teeth: draft.teeth } : { kind: "jaw", jaw: draft.tab },
        lockedTeeth,
      ),
    );
  };

  /** A change that would drop a locked tooth is refused. */
  const keepLocked = (next: ToothPick[], current: ToothPick[]) =>
    lockedTeeth.some((fdi) => current.some((pick) => pick.fdi === fdi) && !next.some((pick) => pick.fdi === fdi))
      ? current
      : next;

  const handleToggleTooth = (fdi: number) =>
    setDraft((current) => ({
      ...current,
      tab: "teeth",
      teeth: keepLocked(toggleTooth(current.teeth, fdi), current.teeth),
    }));
  const handleToggleSurface = (fdi: number, surface: ToothSurface) =>
    setDraft((current) => ({
      ...current,
      tab: "teeth",
      teeth: keepLocked(toggleSurface(current.teeth, fdi, surface), current.teeth),
    }));

  const picking = draft.tab === "teeth";

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width="min(1024px, calc(100vw - 32px))"
      className="tp-dialog tp-teeth-dialog"
      title={t("Treatment:Tooth:ToothPicker")}
      closeIcon={<X size={20} aria-hidden="true" />}
      destroyOnHidden
    >
      <div className="tp-teeth-head">
        <ToothPickerTabs value={draft.tab} onChange={handleTab} />
        {picking && <DentitionRadio value={draft.dentition} onChange={handleDentition} />}
      </div>

      {lockedTeeth.length > 0 && (
        <p className="tp-teeth-locked">{t("Treatment:Tooth:StagedToothLocked", lockedTeeth.join(", "))}</p>
      )}

      {picking && (
        <div className="tp-teeth-chart">
          <ToothChart
            value={draft.teeth}
            dentition={draft.dentition}
            onToggleTooth={handleToggleTooth}
            onToggleSurface={handleToggleSurface}
          />
        </div>
      )}

      <div className="tp-teeth-foot">
        <button type="button" className="tp-btn tp-btn--primary" onClick={handleConfirm}>
          {t("Treatment:Tooth:ToothPicker")}
        </button>
      </div>
    </Modal>
  );
}
