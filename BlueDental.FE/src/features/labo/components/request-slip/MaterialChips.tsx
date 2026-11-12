import { t } from "@/lib/i18n";
import type { LaboMaterialOption } from "@/hooks/useLaboPickers";

interface Props {
  /** The picked materials, in the order they were ticked. */
  picked: LaboMaterialOption[];
  editable: boolean;
  onRemove: (materialId: string) => void;
  onClear: () => void;
}

/** The Vật liệu picked on the Phiếu yêu cầu (P1311), each with its ×, then Bỏ chọn tất cả. */
export function MaterialChips({ picked, editable, onRemove, onClear }: Props) {
  if (picked.length === 0) return null;

  return (
    <div className="rs-mchips">
      {picked.map((option) => (
        <span key={option.value} className="rs-mchip">
          {option.label}
          {editable && (
            <button
              type="button"
              className="rs-mchipx"
              aria-label={t("Labo:Slip:Unpick", option.label)}
              onClick={() => onRemove(option.value)}
            >
              ×
            </button>
          )}
        </span>
      ))}
      {editable && (
        <button type="button" className="rs-mlink" onClick={onClear}>
          {t("Labo:Slip:UnpickAll")}
        </button>
      )}
    </div>
  );
}
