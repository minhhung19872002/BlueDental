import { Loader2, Save } from "lucide-react";
import { t } from "@/lib/i18n";
import { moneyText } from "../plan/planTypes";
import { AdviseSelectedCard } from "./AdviseSelectedCard";
import { rowTotals } from "./adviseTypes";
import type { AdviseSelection } from "./useAdviseSelection";

interface Props {
  selection: AdviseSelection;
  saving: boolean;
  onCancel: () => void;
  onSave: () => void;
}

/**
 * The right column of "Chọn dịch vụ" (P0111_02, R-1114): what is ticked, as
 * cards, with "Bỏ chọn tất cả"; below, the totals and Hủy / "Lưu n dịch vụ".
 * It takes the place of the summary card that sat under the table.
 */
export function AdviseSelectedPanel({ selection, saving, onCancel, onSave }: Props) {
  const rows = [...selection.rows.values()];
  const combos = [...selection.combos.values()];
  const count = rows.length + combos.length;
  const { totals } = selection;

  return (
    <aside className="am-summary" aria-label={t("Treatment:Advise:Picked")}>
      <div className="am-summary-head">
        <span className="am-summary-count">{count}</span>
        <span className="am-summary-title">{t("Treatment:Advise:Picked")}</span>
        {count > 0 && (
          <button type="button" className="am-unpick-all" onClick={selection.clear}>
            {t("Treatment:Advise:UnpickAll")}
          </button>
        )}
      </div>

      {count === 0 ? (
        <p className="am-summary-empty">{t("Treatment:Advise:PickedEmpty")}</p>
      ) : (
        <ul className="am-summary-items">
          {rows.map((row) => (
            <AdviseSelectedCard
              key={`single:${row.service.id}`}
              kind="single"
              name={row.service.name}
              detail={t("Treatment:Advise:QtyTimesPrice", row.quantity, moneyText(row.price))}
              amount={rowTotals(row).effective}
              note={row.note}
              onNoteChange={(note) => selection.update(row.service.id, { note })}
              onRemove={() => selection.toggle(row.service, false)}
            />
          ))}
          {combos.map((combo) => (
            <AdviseSelectedCard
              key={`combo:${combo.id}`}
              kind="combo"
              name={combo.name}
              detail={t("Treatment:Advise:ServiceCount", combo.parts.length)}
              amount={combo.salePrice}
              onRemove={() => selection.toggleCombo(combo, false)}
            />
          ))}
        </ul>
      )}

      <div className="am-summary-foot">
        <div className="am-summary-row">
          <span>{t("Treatment:Advise:Gross")}</span>
          <span>{moneyText(totals.gross)}</span>
        </div>
        <div className="am-summary-row">
          <span>{t("Treatment:Advise:Col:Discount")}</span>
          <span>{moneyText(totals.discount)}</span>
        </div>
        <div className="am-summary-row">
          <span>{t("Treatment:Advise:ComboDiscount")}</span>
          <span className="am-summary-combo-off">{moneyText(totals.comboDiscount)}</span>
        </div>
        <div className="am-summary-row am-summary-row--total">
          <span>{t("Treatment:Advise:Col:Amount")}</span>
          <span className="am-summary-total">{moneyText(totals.effective)}</span>
        </div>
        <div className="am-summary-actions">
          <button type="button" className="tp-btn am-cancel" onClick={onCancel}>
            {t("Common:Cancel")}
          </button>
          <button type="button" className="tp-btn tp-btn--primary am-save" disabled={count === 0 || saving} onClick={onSave}>
            {saving ? <Loader2 size={16} className="am-spin" /> : <Save size={16} />}
            {t("Treatment:Advise:SaveCount", count)}
          </button>
        </div>
      </div>
    </aside>
  );
}
