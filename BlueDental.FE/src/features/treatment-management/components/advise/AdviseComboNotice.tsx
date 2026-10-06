import { Lightbulb } from "lucide-react";
import { t, tRich } from "@/lib/i18n";
import { moneyText } from "../plan/planTypes";
import type { ComboSuggestion } from "./comboSuggestion";

interface Props {
  suggestion: ComboSuggestion;
  /** "Áp dụng Combo" — opens the Combo tab. */
  onApply: () => void;
}

/**
 * The orange notice of "Chọn Dịch Vụ" (review P0510): a ticked service is
 * part of a combo, so say which services would complete it and what it
 * saves. Its button opens the Combo tab — it picks nothing by itself.
 */
export function AdviseComboNotice({ suggestion, onApply }: Props) {
  const { combo, missing } = suggestion;
  const saving = moneyText(combo.savings);
  const body =
    missing.length > 0
      ? t("Treatment:Combo:SuggestAdd", missing.map((part) => part.name).join(", "), combo.name, saving)
      : t("Treatment:Combo:SuggestComplete", combo.name, saving);

  return (
    <div className="am-combo-notice" role="status">
      <Lightbulb size={16} aria-hidden="true" className="am-combo-notice-icon" />
      <p>{tRich("Treatment:Combo:SuggestLead", <b>{t("Treatment:Combo:SuggestLabel")}</b>, body)}</p>
      <button type="button" className="am-combo-notice-btn" onClick={onApply}>
        {t("Treatment:Combo:Apply")}
      </button>
    </div>
  );
}
