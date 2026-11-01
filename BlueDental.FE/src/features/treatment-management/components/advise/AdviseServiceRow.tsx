import { memo } from "react";
import { Checkbox } from "antd";
import { CurrencyInput } from "@/components/CurrencyInput";
import { t } from "@/lib/i18n";
import type { CatalogOption } from "@/hooks/useCatalogOptions";
import { DISCOUNT_TYPE } from "../../api/consultingApi";
import { moneyText } from "../plan/planTypes";
import { AdviseQtyStepper } from "./AdviseQtyStepper";
import { rowTotals, type AdviseRowDraft } from "./adviseTypes";

const DISCOUNT_UNITS = [
  { type: DISCOUNT_TYPE.Percentage, label: "%" },
  { type: DISCOUNT_TYPE.Money, label: "Treatment:Pricing:UnitVnd" },
] as const;

interface Props {
  service: CatalogOption;
  /** Null while the row is unticked — its editors then stay hidden. */
  draft: AdviseRowDraft | null;
  onToggle: (service: CatalogOption, checked: boolean) => void;
  onChange: (serviceId: string, patch: Partial<AdviseRowDraft>) => void;
}

/**
 * One service in "Chọn dịch vụ". Ticking it opens the row's editors — price,
 * the − n + stepper, discount with its %/VNĐ switch — and Thành tiền follows
 * what is typed, the same arithmetic the server will apply. The BA kept price
 * and discount editable (P0111_02, R-1114); the note moved to the card on the
 * right.
 */
export const AdviseServiceRow = memo(function AdviseServiceRow({ service, draft, onToggle, onChange }: Props) {
  const totals = draft ? rowTotals(draft) : null;

  return (
    <tr className={draft ? "am-row am-row--on" : "am-row"}>
      <td className="am-cell-check">
        <Checkbox
          checked={draft !== null}
          aria-label={service.name}
          onChange={(event) => onToggle(service, event.target.checked)}
        />
      </td>
      <td className="am-cell-name">{service.name}</td>
      <td className="am-cell-group">{service.taxonomyName}</td>
      <td className="am-cell-money">
        {draft ? (
          <CurrencyInput
            aria-label={t("Treatment:Pricing:UnitPrice")}
            value={draft.price}
            onChange={(value) => onChange(service.id, { price: value ?? 0 })}
          />
        ) : (
          moneyText(service.salePrice)
        )}
      </td>
      <td className="am-cell-center">
        {draft ? (
          <AdviseQtyStepper value={draft.quantity} onChange={(quantity) => onChange(service.id, { quantity })} />
        ) : (
          <span className="am-muted">—</span>
        )}
      </td>
      <td>
        {!draft && <span className="am-muted">—</span>}
        {draft && (
          <div className="am-discount">
            <div className="tp-toggle" role="group" aria-label={t("Treatment:Pricing:DiscountUnit")}>
              {DISCOUNT_UNITS.map((unit) => (
                <button
                  key={unit.type}
                  type="button"
                  className={draft.discountType === unit.type ? "active" : undefined}
                  aria-pressed={draft.discountType === unit.type}
                  onClick={() => onChange(service.id, { discountType: unit.type, discountValue: 0 })}
                >
                  {t(unit.label)}
                </button>
              ))}
            </div>
            <CurrencyInput
              aria-label={t("Treatment:Pricing:Discount")}
              value={draft.discountValue}
              onChange={(value) => onChange(service.id, { discountValue: value ?? 0 })}
            />
          </div>
        )}
      </td>
      <td className="am-cell-amount">{totals ? moneyText(totals.effective) : moneyText(service.salePrice)}</td>
    </tr>
  );
});
