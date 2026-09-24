import { memo } from "react";
import { Checkbox, Input, InputNumber } from "antd";
import { CurrencyInput } from "@/components/CurrencyInput";
import { t } from "@/lib/i18n";
import type { CatalogOption } from "@/hooks/useCatalogOptions";
import { DISCOUNT_TYPE } from "../../api/consultingApi";
import { moneyText } from "../plan/planTypes";
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
 * One service in "Chọn Dịch Vụ". Ticking it opens the row's editors — price,
 * quantity, discount with its %/VNĐ switch, note — and the amount column
 * follows what is typed, the same arithmetic the server will apply.
 */
export const AdviseServiceRow = memo(function AdviseServiceRow({
  service,
  draft,
  onToggle,
  onChange,
}: Props) {
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
      <td>
        {draft ? (
          <CurrencyInput
            aria-label={t("Treatment:Pricing:UnitPrice")}
            value={draft.price}
            onChange={(value) => onChange(service.id, { price: value ?? 0 })}
          />
        ) : (
          moneyText(service.price)
        )}
      </td>
      <td>
        {draft && (
          <InputNumber
            aria-label={t("Treatment:Pricing:Quantity")}
            min={1}
            precision={0}
            value={draft.quantity}
            onChange={(value) => onChange(service.id, { quantity: value ?? 1 })}
          />
        )}
      </td>
      <td>
        {/* Unticked, the reference prints the discount the row would carry: 0 đ. */}
        {!draft && <span className="am-muted">{moneyText(0)}</span>}
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
      <td className="am-cell-amount">{totals ? moneyText(totals.effective) : moneyText(service.price)}</td>
      <td>
        {draft ? (
          <Input
            aria-label={t("Treatment:Common:Note")}
            value={draft.note}
            onChange={(event) => onChange(service.id, { note: event.target.value })}
          />
        ) : (
          <span className="am-muted">—</span>
        )}
      </td>
    </tr>
  );
});
