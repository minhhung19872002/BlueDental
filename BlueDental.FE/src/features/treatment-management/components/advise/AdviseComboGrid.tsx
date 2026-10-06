import { memo } from "react";
import { Spin } from "antd";
import { Check } from "lucide-react";
import type { CatalogComboOption } from "@/hooks/useCatalogCombos";
import { t } from "@/lib/i18n";
import { moneyText } from "../plan/planTypes";

interface Props {
  combos: CatalogComboOption[];
  loading: boolean;
  picked: ReadonlyMap<string, CatalogComboOption>;
  onToggle: (combo: CatalogComboOption, picked: boolean) => void;
}

/**
 * The Combo tab of "Chọn Dịch Vụ" (review P0510): one card per combo with
 * its parts, Tổng giá lẻ struck through, Giá combo and the saving. Several
 * combos may be picked; a picked card's button reads "Hủy dịch vụ".
 */
export function AdviseComboGrid({ combos, loading, picked, onToggle }: Props) {
  if (loading) {
    return (
      <div className="am-combo-empty">
        <Spin size="small" />
      </div>
    );
  }
  if (combos.length === 0) {
    return <div className="am-combo-empty">{t("Treatment:Combo:NoCombo")}</div>;
  }

  return (
    <div className="am-combo-grid">
      {combos.map((combo) => (
        <AdviseComboCard key={combo.id} combo={combo} picked={picked.has(combo.id)} onToggle={onToggle} />
      ))}
    </div>
  );
}

interface CardProps {
  combo: CatalogComboOption;
  picked: boolean;
  onToggle: (combo: CatalogComboOption, picked: boolean) => void;
}

const AdviseComboCard = memo(function AdviseComboCard({ combo, picked, onToggle }: CardProps) {
  return (
    <article className={picked ? "am-combo-card am-combo-card--on" : "am-combo-card"} aria-label={combo.name}>
      <header className="am-combo-card-head">
        <div className="bd-min0">
          <h3>{combo.name}</h3>
          {combo.description && <p className="am-combo-card-desc">{combo.description}</p>}
        </div>
        {combo.savingsPercent > 0 && <span className="am-combo-card-off">-{combo.savingsPercent}%</span>}
      </header>

      <ul className="am-combo-card-parts">
        {combo.parts.map((part) => (
          <li key={part.serviceId}>
            <Check size={14} aria-hidden="true" />
            <span className="am-combo-card-part">
              {part.name}
              {part.quantity > 1 && <span className="am-muted"> ×{part.quantity}</span>}
            </span>
            <span>{moneyText(part.retailPrice * part.quantity)}</span>
          </li>
        ))}
      </ul>

      <footer className="am-combo-card-foot">
        <div className="bd-min0">
          {combo.retailPrice > combo.salePrice && <s className="am-muted">{moneyText(combo.retailPrice)}</s>}
          <p className="am-combo-card-price">{moneyText(combo.salePrice)}</p>
          {combo.savings > 0 && (
            <p className="am-combo-card-save">{t("Treatment:Combo:Saves", moneyText(combo.savings))}</p>
          )}
        </div>
        <button
          type="button"
          className={picked ? "tp-btn am-combo-card-btn am-combo-card-btn--on" : "tp-btn tp-btn--primary am-combo-card-btn"}
          aria-pressed={picked}
          onClick={() => onToggle(combo, !picked)}
        >
          {picked ? t("Treatment:Combo:Unpick") : t("Treatment:Combo:Pick")}
        </button>
      </footer>
    </article>
  );
});
