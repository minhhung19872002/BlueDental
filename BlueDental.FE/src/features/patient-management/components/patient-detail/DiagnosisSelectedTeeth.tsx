import { CloseOutlined } from "@ant-design/icons";
import { formatToothPick, jawLabel, type ToothPickerValue } from "@/components/ToothChart";
import { t } from "@/lib/i18n";

interface Props {
  value: ToothPickerValue;
  onRemoveTooth: (fdi: number) => void;
  onClearJaw: () => void;
}

interface ChipProps {
  label: string;
  removeLabel: string;
  onRemove: () => void;
}

function Chip({ label, removeLabel, onRemove }: ChipProps) {
  return (
    <span className="pd-tooth-chip">
      {label}
      <button type="button" aria-label={removeLabel} onClick={onRemove}>
        <CloseOutlined />
      </button>
    </span>
  );
}

/**
 * "Răng đã chọn" — the reference's grey box under the note. One chip per
 * tooth ("16 - Mặt ngoài, Mặt nhai"), or a single chip for a whole jaw, each
 * with a red X that takes it back off the chart.
 */
export function DiagnosisSelectedTeeth({ value, onRemoveTooth, onClearJaw }: Props) {
  const chips =
    value.kind === "jaw"
      ? [
          <Chip
            key="jaw"
            label={jawLabel(value.jaw)}
            removeLabel={t("Bỏ chọn {0}", jawLabel(value.jaw))}
            onRemove={onClearJaw}
          />,
        ]
      : value.teeth.map((pick) => (
          <Chip
            key={pick.fdi}
            label={formatToothPick(pick)}
            removeLabel={t("Bỏ chọn răng {0}", pick.fdi)}
            onRemove={() => onRemoveTooth(pick.fdi)}
          />
        ));

  return (
    <div className="pd-selected-teeth" data-testid="selected-teeth">
      <strong>{t("Răng đã chọn")}</strong>
      {chips.length === 0 ? (
        <span className="pd-selected-teeth__empty">{t("Chưa chọn răng")}</span>
      ) : (
        <div className="pd-selected-teeth__chips">{chips}</div>
      )}
    </div>
  );
}
