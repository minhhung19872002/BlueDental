import { Checkbox } from "antd";
import { t } from "@/lib/i18n";
import { formatDate } from "@/utils/format";
import { toothKey } from "../check/laboCheckRules";
import { LaboWarrantyPickRow } from "./LaboWarrantyPickRow";
import type { LaboWarrantyForm } from "./useLaboWarrantyForm";
import type { WarrantyToothJump } from "./useWarrantyToothJump";

interface Props {
  warranty: LaboWarrantyForm;
  restoration: string;
  jump: WarrantyToothJump;
}

/**
 * 1. Chọn răng kích hoạt: a card per Đạt tooth still without a warranty card,
 * and "Tất cả" on the title — ticked when every tooth is, half when some are.
 */
export function LaboWarrantyToothPicker({ warranty, restoration, jump }: Props) {
  const { pending: teeth, open } = warranty;
  const disabled = warranty.busy || !open;
  const isPicked = (tooth: number) => open && warranty.selected.includes(tooth);
  const pickedCount = teeth.filter((tooth) => isPicked(tooth.toothNumber)).length;
  const allPicked = teeth.length > 0 && pickedCount === teeth.length;

  const handleJump = (tooth: number) => {
    if (!isPicked(tooth)) warranty.toggle(tooth);
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
            caption={{
              restoration,
              passedOn: tooth.passedAt ? t("Labo:Warranty:PassedOn", formatDate(tooth.passedAt)) : undefined,
            }}
            pick={{
              on: isPicked(tooth.toothNumber),
              card: warranty.cards?.[toothKey(tooth.toothNumber)],
              focused: jump.focused === tooth.toothNumber && isPicked(tooth.toothNumber),
            }}
            disabled={disabled}
            onToggle={() => warranty.toggle(tooth.toothNumber)}
            onJump={() => handleJump(tooth.toothNumber)}
          />
        ))}
      </ul>
      {!open && <p className="pd-labo-warranty-note">{t("Labo:Warranty:NotYetOpen")}</p>}
    </div>
  );
}
