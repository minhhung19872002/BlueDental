import { memo } from "react";
import { Checkbox } from "antd";
import type { CatalogComboOption } from "@/hooks/useCatalogCombos";
import { t } from "@/lib/i18n";
import { moneyText } from "../plan/planTypes";
import { AdviseTableShell, type AdviseColumn } from "./AdviseTableShell";

interface Props {
  combos: CatalogComboOption[];
  loading: boolean;
  picked: ReadonlyMap<string, CatalogComboOption>;
  onToggle: (combo: CatalogComboOption, picked: boolean) => void;
}

const COLUMNS: readonly AdviseColumn[] = [
  { key: "service", label: "Treatment:Advise:Col:Combo" },
  { key: "parts", label: "Treatment:Advise:Col:Parts" },
  { key: "retail", label: "Treatment:Advise:Col:RetailPrice", align: "end" },
  { key: "savings", label: "Treatment:Advise:Col:Savings", align: "end" },
  { key: "amount", label: "Treatment:Advise:Col:ComboPrice", align: "end" },
];

/**
 * The Combo tab of "Chọn dịch vụ", in the same table as Dịch vụ lẻ
 * (P0111_02, R-1114 — "đồng bộ"): the combo with its parts under the name,
 * Tổng giá lẻ, the saving and Giá combo. Several combos may be ticked;
 * ticking one clears the ticked single services (review P0510).
 */
export function AdviseComboTable({ combos, loading, picked, onToggle }: Props) {
  return (
    <AdviseTableShell
      variant="combo"
      columns={COLUMNS}
      rowCount={combos.length}
      loading={loading}
      emptyText={t("Treatment:Combo:NoCombo")}
      headCheck={null}
    >
      {combos.map((combo) => (
        <AdviseComboRow key={combo.id} combo={combo} picked={picked.has(combo.id)} onToggle={onToggle} />
      ))}
    </AdviseTableShell>
  );
}

interface RowProps {
  combo: CatalogComboOption;
  picked: boolean;
  onToggle: (combo: CatalogComboOption, picked: boolean) => void;
}

const AdviseComboRow = memo(function AdviseComboRow({ combo, picked, onToggle }: RowProps) {
  const parts = combo.parts.map((part) => (part.quantity > 1 ? `${part.name} ×${part.quantity}` : part.name));
  return (
    <tr className={picked ? "am-row am-row--on" : "am-row"}>
      <td className="am-cell-check">
        <Checkbox checked={picked} aria-label={combo.name} onChange={(event) => onToggle(combo, event.target.checked)} />
      </td>
      <td className="am-cell-name">
        {combo.name}
        {combo.description && <span className="am-cell-sub">{combo.description}</span>}
      </td>
      <td className="am-cell-group" title={parts.join(", ")}>
        <span className="am-parts-count">{t("Treatment:Advise:ServiceCount", combo.parts.length)}</span>
        <span className="am-cell-sub">{parts.join(", ")}</span>
      </td>
      <td className="am-cell-money">
        {combo.retailPrice > combo.salePrice ? <s className="am-muted">{moneyText(combo.retailPrice)}</s> : moneyText(combo.retailPrice)}
      </td>
      <td className="am-cell-money am-cell-save">
        {combo.savings > 0 ? (
          <>
            {moneyText(combo.savings)}
            {combo.savingsPercent > 0 && <span className="am-save-pct">-{combo.savingsPercent}%</span>}
          </>
        ) : (
          <span className="am-muted">—</span>
        )}
      </td>
      <td className="am-cell-amount">{moneyText(combo.salePrice)}</td>
    </tr>
  );
});
