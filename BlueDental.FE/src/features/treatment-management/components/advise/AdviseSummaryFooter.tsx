import { Loader2, Save } from "lucide-react";
import { t, tRich } from "@/lib/i18n";
import { moneyText } from "../plan/planTypes";
import type { AdviseTotals } from "./adviseTypes";

interface Props {
  /** The diagnosis slip's code, e.g. CD10. */
  slipCode: string;
  count: number;
  totals: AdviseTotals;
  saving: boolean;
  canSave: boolean;
  onSave: () => void;
}

/**
 * The foot of "Chọn Dịch Vụ": the summary card on the left — how many
 * services are ticked, against which slip, and what they come to — and the
 * save button on the right, which stays off until something is ticked.
 */
export function AdviseSummaryFooter({ slipCode, count, totals, saving, canSave, onSave }: Props) {
  return (
    <div className="am-foot">
      <div className="am-summary">
        <div className="am-summary-head">
          <span className="am-summary-count">{count}</span>
          <span>
            {tRich("Dịch vụ đã chọn với số phiếu chẩn đoán: {0}", <b className="am-summary-code">{slipCode}</b>)}
          </span>
        </div>
        <div className="am-summary-row">
          <span>{t("Tổng cộng:")}</span>
          <span>{moneyText(totals.gross)}</span>
        </div>
        <div className="am-summary-row">
          <span>{t("Giảm giá:")}</span>
          <span>{moneyText(totals.discount)}</span>
        </div>
        <div className="am-summary-row am-summary-row--total">
          <span>{t("Thành tiền:")}</span>
          <span className="am-summary-total">{moneyText(totals.effective)}</span>
        </div>
      </div>
      <button type="button" className="tp-btn tp-btn--primary am-save" disabled={!canSave || saving} onClick={onSave}>
        {saving ? <Loader2 size={16} className="am-spin" /> : <Save size={16} />}
        {t("Lưu")}
      </button>
    </div>
  );
}
