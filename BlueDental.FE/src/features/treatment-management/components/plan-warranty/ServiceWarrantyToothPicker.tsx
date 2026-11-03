import { Checkbox } from "antd";
import { LaboWarrantyPickRow } from "@/features/labo/components/warranty/LaboWarrantyPickRow";
import type { WarrantyToothJump } from "@/features/labo/components/warranty/useWarrantyToothJump";
import { t } from "@/lib/i18n";
import type { WarrantyServiceRowDto } from "../../api/planWarrantyApi";
import { completedOnText } from "./serviceWarrantyRules";
import type { ServiceWarrantyForm } from "./useServiceWarrantyForm";

interface Props {
  warranty: ServiceWarrantyForm;
  row: WarrantyServiceRowDto;
  jump: WarrantyToothJump;
}

/**
 * 1. Chọn răng kích hoạt, as on Labo's: a row per tooth of the line still
 * without a dental card, and "Tất cả" on the title — ticked when every tooth
 * is, half when some are. A row's › picks it if need be and jumps to its form.
 */
export function ServiceWarrantyToothPicker({ warranty, row, jump }: Props) {
  const { teeth, selected } = warranty;
  const allPicked = teeth.length > 0 && selected.length === teeth.length;
  const caption = { restoration: row.serviceName, passedOn: completedOnText(row) };

  const handleJump = (tooth: number) => {
    if (!selected.includes(tooth)) warranty.toggle(tooth);
    jump.jumpTo(tooth);
  };

  return (
    <div className="pd-labo-warranty-step">
      <h4 className="pd-labo-warranty-step-title">
        <span className="pd-labo-check-badge">1</span>
        {t("Labo:Warranty:PickTitle")}
        <Checkbox
          className="pd-labo-warranty-pick-all"
          checked={allPicked}
          indeterminate={selected.length > 0 && !allPicked}
          disabled={warranty.busy}
          onChange={(event) => warranty.toggleAll(event.target.checked)}
        >
          {t("Labo:Warranty:PickAll")}
        </Checkbox>
      </h4>
      <ul className="pd-labo-wpick-list">
        {teeth.map((tooth) => {
          const on = selected.includes(tooth);
          return (
            <LaboWarrantyPickRow
              key={tooth}
              toothNumber={tooth}
              caption={caption}
              pick={{ on, card: warranty.sharing.cardOf(tooth), focused: on && jump.focused === tooth }}
              disabled={warranty.busy}
              onToggle={() => warranty.toggle(tooth)}
              onJump={() => handleJump(tooth)}
            />
          );
        })}
      </ul>
    </div>
  );
}
