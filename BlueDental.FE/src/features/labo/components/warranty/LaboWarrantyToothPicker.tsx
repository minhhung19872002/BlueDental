import { Checkbox } from "antd";
import { surfaceList } from "@/components/ToothSurfacePicker";
import { t } from "@/lib/i18n";
import { formatDate } from "@/utils/format";
import type { LaboOrderToothDto } from "@/features/labo/api/laboApi";
import { orderedFaces } from "../check/laboToothFaces";
import { LaboWarrantyPickRow } from "./LaboWarrantyPickRow";
import { LaboWarrantyReadyMeter } from "./LaboWarrantyReadyMeter";
import type { LaboWarrantyForm } from "./useLaboWarrantyForm";
import type { WarrantyActiveTooth } from "./useWarrantyActiveTooth";
import type { WarrantyToothJump } from "./useWarrantyToothJump";

interface Props {
  warranty: LaboWarrantyForm;
  /** "Sứ Zirconia": the caption of a tooth ordered before R-1150, which has no faces. */
  restoration: string;
  jump: WarrantyToothJump;
  active: WarrantyActiveTooth;
}

/** "Gần, Xa, Cắn, Ngoài" · "Đạt 01/11/2026" (BA mock BaoHanhV2). */
const captionOf = (tooth: LaboOrderToothDto, restoration: string) => ({
  restoration: surfaceList(orderedFaces(tooth)) || restoration,
  passedOn: tooth.passedAt ? t("Labo:Warranty:PassedOn", formatDate(tooth.passedAt)) : undefined,
});

/**
 * 1. Chọn răng kích hoạt: a card per Đạt tooth still without a warranty card,
 * "Tất cả" on the title — ticked when every tooth is, half when some are —
 * and Đủ thông tin r/s răng under them. Pressing a card opens its tooth's form.
 */
export function LaboWarrantyToothPicker({ warranty, restoration, jump, active }: Props) {
  const { pending: teeth, open } = warranty;
  const disabled = warranty.busy || !open;
  const isPicked = (tooth: number) => open && warranty.selected.includes(tooth);
  const pickedCount = teeth.filter((tooth) => isPicked(tooth.toothNumber)).length;
  const allPicked = teeth.length > 0 && pickedCount === teeth.length;
  const focusedOf = (tooth: number) =>
    isPicked(tooth) && (warranty.sharing.on ? jump.focused === tooth : active.active === tooth);

  const handleJump = (tooth: number) => {
    if (!isPicked(tooth)) warranty.toggle(tooth);
    active.show(tooth);
    jump.jumpTo(tooth);
  };

  return (
    <div className="pd-labo-warranty-step">
      <h4 className="pd-labo-warranty-step-title">
        <span className="pd-labo-check-badge">1</span>
        {t("Labo:Warranty:PickTitle")}
        {teeth.length > 0 && (
          <Checkbox
            className="pd-labo-warranty-pick-all"
            checked={allPicked}
            indeterminate={pickedCount > 0 && !allPicked}
            disabled={disabled}
            onChange={(event) => warranty.toggleAll(event.target.checked)}
          >
            {t("Labo:Warranty:PickAll")}
          </Checkbox>
        )}
      </h4>
      <ul className="pd-labo-wpick-list">
        {teeth.map((tooth) => (
          <LaboWarrantyPickRow
            key={tooth.toothNumber}
            toothNumber={tooth.toothNumber}
            caption={captionOf(tooth, restoration)}
            pick={{
              on: isPicked(tooth.toothNumber),
              card: warranty.sharing.cardOf(tooth.toothNumber),
              focused: focusedOf(tooth.toothNumber),
            }}
            disabled={disabled}
            onToggle={() => warranty.toggle(tooth.toothNumber)}
            onJump={() => handleJump(tooth.toothNumber)}
          />
        ))}
      </ul>
      {!open && <p className="pd-labo-warranty-note">{t("Labo:Warranty:NotYetOpen")}</p>}
      {open && pickedCount > 0 && <LaboWarrantyReadyMeter ready={warranty.readyCount} total={pickedCount} />}
    </div>
  );
}
