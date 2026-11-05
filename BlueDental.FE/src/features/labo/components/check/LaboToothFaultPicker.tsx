import { t } from "@/lib/i18n";
import {
  orderedSurfaces,
  toggledSurfaces,
  ToothSurfacePicker,
  type ToothSurfaceCode,
} from "@/components/ToothSurfacePicker";
import type { LaboOrderToothDto } from "@/features/labo/api/laboApi";
import { faceShades, orderedFaces } from "./laboToothFaces";

interface Props {
  tooth: LaboOrderToothDto;
  disabled: boolean;
  /** Form.Item's: the Mặt bị lỗi codes. */
  value?: string[];
  onChange?: (faults: ToothSurfaceCode[]) => void;
}

/**
 * "Bấm mặt bị lỗi" (Labo 2 v2, R-1151): the tooth's picture with only the
 * faces it was ordered on live, each with its name and Màu; a click marks a
 * face faulty or clears it.
 */
export function LaboToothFaultPicker({ tooth, disabled, value, onChange }: Props) {
  const no = tooth.toothNumber;
  const faults = orderedSurfaces(no, value ?? []);
  const handlePick = (code: ToothSurfaceCode) => onChange?.(toggledSurfaces(no, faults, code));
  return (
    <div className="pd-labo-fault-picker" data-tooth={no}>
      <ToothSurfacePicker
        tooth={no}
        picked={orderedFaces(tooth)}
        shades={faceShades(tooth)}
        marks={{ faults }}
        onPick={disabled ? undefined : handlePick}
      />
      <span className="pd-labo-fault-hint">{t("Labo:Check:FaultHint")}</span>
    </div>
  );
}
