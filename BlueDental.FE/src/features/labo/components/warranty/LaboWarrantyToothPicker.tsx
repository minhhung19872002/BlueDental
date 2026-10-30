import { CheckOutlined } from "@ant-design/icons";
import { t } from "@/lib/i18n";
import { formatDate } from "@/utils/format";
import type { LaboOrderToothDto } from "@/features/labo/api/laboApi";

interface Props {
  teeth: LaboOrderToothDto[];
  restoration: string;
  selected: number[];
  /** False until the whole order passed: the chips show, but cannot be picked. */
  open: boolean;
  disabled: boolean;
  onToggle: (tooth: number) => void;
}

/** 1. Chọn răng cần kích hoạt: one chip per Đạt tooth still without a card. */
export function LaboWarrantyToothPicker({ teeth, restoration, selected, open, disabled, onToggle }: Props) {
  return (
    <div className="pd-labo-warranty-step">
      <h4 className="pd-labo-warranty-step-title">
        <span className="pd-labo-check-badge">1</span>
        {t("Labo:Warranty:PickTitle")}
      </h4>
      <div className="pd-labo-warranty-picks">
        {teeth.map((tooth) => {
          const on = open && selected.includes(tooth.toothNumber);
          const label = [
            t("Labo:Check:ToothLabel", tooth.toothNumber),
            restoration,
            tooth.passedAt ? t("Labo:Warranty:PassedOn", formatDate(tooth.passedAt)) : "",
          ]
            .filter(Boolean)
            .join(" · ");
          return (
            <button
              key={tooth.toothNumber}
              type="button"
              className={["pd-labo-warranty-pick", on && "pd-labo-warranty-pick--on"].filter(Boolean).join(" ")}
              aria-pressed={on}
              disabled={disabled || !open}
              onClick={() => onToggle(tooth.toothNumber)}
            >
              {on && <CheckOutlined />}
              {label}
            </button>
          );
        })}
      </div>
      {!open && <p className="pd-labo-warranty-note">{t("Labo:Warranty:NotYetOpen")}</p>}
    </div>
  );
}
