import { useEffect, useState } from "react";
import { Modal } from "antd";
import { X } from "lucide-react";
import {
  ToothChart,
  dentitionOf,
  toggleSurface,
  toggleTooth,
  type Dentition,
  type ToothPick,
  type ToothSurface,
} from "@/components/ToothChart";
import { t } from "@/lib/i18n";
import { ToothPickerTabs } from "./ToothPickerTabs";
import type { ToothPickerTab, ToothPickerValue } from "./toothPicker";

interface Props {
  open: boolean;
  value: ToothPickerValue;
  onConfirm: (value: ToothPickerValue) => void;
  onClose: () => void;
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

const DENTITIONS: readonly { key: Dentition; label: () => string }[] = [
  { key: "permanent", label: () => t("Răng vĩnh viễn") },
  { key: "deciduous", label: () => t("Răng sữa") },
];

/**
 * "Chọn răng": the tab strip, the dentition radios and the surface chart.
 * A jaw tab stands for the whole jaw, so it hides the chart (the dialog
 * collapses to the strip and the button) and drops any individual picks.
 * Reopening starts from the last confirmed value.
 */
export function ToothPickerDialog({ open, value, onConfirm, onClose }: Props) {
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
    onConfirm(draft.tab === "teeth" ? { kind: "teeth", teeth: draft.teeth } : { kind: "jaw", jaw: draft.tab });
  };

  const handleToggleTooth = (fdi: number) =>
    setDraft((current) => ({ ...current, tab: "teeth", teeth: toggleTooth(current.teeth, fdi) }));
  const handleToggleSurface = (fdi: number, surface: ToothSurface) =>
    setDraft((current) => ({ ...current, tab: "teeth", teeth: toggleSurface(current.teeth, fdi, surface) }));

  const picking = draft.tab === "teeth";

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width="min(1024px, calc(100vw - 32px))"
      className="tp-dialog tp-teeth-dialog"
      title={t("Chọn răng")}
      closeIcon={<X size={20} aria-hidden="true" />}
      destroyOnHidden
    >
      <div className="tp-teeth-head">
        <ToothPickerTabs value={draft.tab} onChange={handleTab} />
        {picking && (
          <div className="tp-teeth-type" role="radiogroup" aria-label={t("Loại răng")}>
            {DENTITIONS.map((item) => (
              <label key={item.key} className="tp-radio">
                <input
                  type="radio"
                  name="tp-teeth-type"
                  value={item.key}
                  checked={draft.dentition === item.key}
                  onChange={() => handleDentition(item.key)}
                />
                <span className="tp-radio__ring" aria-hidden="true" />
                {item.label()}
              </label>
            ))}
          </div>
        )}
      </div>

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
          {t("Chọn răng")}
        </button>
      </div>
    </Modal>
  );
}
