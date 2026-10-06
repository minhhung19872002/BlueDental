import { Loader2, Save, X } from "lucide-react";
import { t, tRich } from "@/lib/i18n";
import { moneyText } from "../plan/planTypes";
import type { AdviseTotals } from "./adviseTypes";

/** One line of the summary card — a ticked service (LẺ) or a picked combo (COMBO). */
export interface AdviseSummaryItem {
  id: string;
  kind: "single" | "combo";
  name: string;
  amount: number;
}

interface Props {
  /** The diagnosis slip's code, e.g. CD10. */
  slipCode: string;
  items: AdviseSummaryItem[];
  totals: AdviseTotals;
  saving: boolean;
  canSave: boolean;
  onRemove: (item: AdviseSummaryItem) => void;
  onSave: () => void;
}

/**
 * The foot of "Chọn Dịch Vụ": the summary card on the left — how many
 * services are ticked, against which slip, and what they come to — and the
 * save button on the right, which stays off until something is ticked.
 */
export function AdviseSummaryFooter({ slipCode, items, totals, saving, canSave, onRemove, onSave }: Props) {
  return (
    <div className="am-foot">
      <div className="am-summary">
        <div className="am-summary-head">
          <span className="am-summary-count">{items.length}</span>
          <span>
            {tRich("Treatment:Advise:SelectedServicesSlip", <b className="am-summary-code">{slipCode}</b>)}
          </span>
        </div>
        {items.length > 0 && (
          <ul className="am-summary-items">
            {items.map((item) => (
              <li key={`${item.kind}:${item.id}`}>
                <span className={item.kind === "combo" ? "am-summary-kind am-summary-kind--combo" : "am-summary-kind"}>
                  {item.kind === "combo" ? t("Treatment:Combo:KindCombo") : t("Treatment:Combo:KindSingle")}
                </span>
                <span className="am-summary-name">{item.name}</span>
                <b>{moneyText(item.amount)}</b>
                <button
                  type="button"
                  className="am-summary-remove"
                  aria-label={t("Treatment:Combo:RemoveItem", item.name)}
                  onClick={() => onRemove(item)}
                >
                  <X size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="am-summary-row">
          <span>{t("Treatment:Combo:GrossColon")}</span>
          <span>{moneyText(totals.gross)}</span>
        </div>
        <div className="am-summary-row">
          <span>{t("Treatment:Pricing:DiscountColon")}</span>
          <span>{moneyText(totals.discount)}</span>
        </div>
        <div className="am-summary-row">
          <span>{t("Treatment:Combo:ComboDiscountColon")}</span>
          <span className="am-summary-combo-off">{moneyText(totals.comboDiscount)}</span>
        </div>
        <div className="am-summary-row am-summary-row--total">
          <span>{t("Treatment:Pricing:NetAmountColon")}</span>
          <span className="am-summary-total">{moneyText(totals.effective)}</span>
        </div>
      </div>
      <button type="button" className="tp-btn tp-btn--primary am-save" disabled={!canSave || saving} onClick={onSave}>
        {saving ? <Loader2 size={16} className="am-spin" /> : <Save size={16} />}
        {t("Common:Save")}
      </button>
    </div>
  );
}
