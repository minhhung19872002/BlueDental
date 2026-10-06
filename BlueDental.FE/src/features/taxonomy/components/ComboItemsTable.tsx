import { Button } from "antd";
import { DeleteOutlined, MinusOutlined, PlusOutlined } from "@ant-design/icons";
import type { ComboPricing, ComboRowDraft } from "../api/comboPricing";
import { CurrencyInput } from "@/components/CurrencyInput";
import { t } from "@/lib/i18n";
import { formatVND } from "@/utils/format";

interface Props {
  rows: ComboRowDraft[];
  pricing: ComboPricing;
  onChange: (componentEntryId: string, patch: Partial<ComboRowDraft>) => void;
  onRemove: (componentEntryId: string) => void;
}

/**
 * "Thành phần combo": one row per service with its quantity stepper, its
 * catalogue "Đơn giá", and a "Thành tiền" that may be edited for this combo
 * alone — the service's own price stays as it is (review P0510).
 */
export function ComboItemsTable({ rows, pricing, onChange, onRemove }: Props) {
  return (
    <section className="bd-combo-items">
      <div className="bd-combo-items-head">
        <p className="bd-dialog-section-title">{t("Taxonomy:Combo:Components")}</p>
        <span className="bd-cat-count">{t("Taxonomy:Combo:ComponentCount", rows.length)}</span>
      </div>

      <table className="bd-combo-table">
        <thead>
          <tr>
            <th>{t("Taxonomy:Combo:ColComponent")}</th>
            <th className="bd-combo-col-qty">{t("Taxonomy:Combo:ColQuantity")}</th>
            <th className="bd-combo-col-money">{t("Taxonomy:Combo:ColUnitPrice")}</th>
            <th className="bd-combo-col-money">{t("Taxonomy:Combo:ColAmount")}</th>
            <th className="bd-combo-col-action">
              <span className="bd-sr-only">{t("Common:Actions")}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={5} className="bd-combo-empty">
                {t("Taxonomy:Combo:ComponentsEmpty")}
              </td>
            </tr>
          )}
          {rows.map((row) => (
            <tr key={row.componentEntryId}>
              <td>
                <span className="bd-combo-kind">{t("Taxonomy:Combo:KindServiceShort")}</span>
                <span className="bd-combo-name">{row.name}</span>
              </td>
              <td className="bd-combo-col-qty">
                <div className="bd-combo-stepper">
                  <Button
                    size="small"
                    icon={<MinusOutlined />}
                    disabled={row.quantity <= 1}
                    aria-label={t("Taxonomy:Combo:Decrease", row.name)}
                    onClick={() => onChange(row.componentEntryId, { quantity: row.quantity - 1 })}
                  />
                  <span aria-live="polite">{row.quantity}</span>
                  <Button
                    size="small"
                    icon={<PlusOutlined />}
                    aria-label={t("Taxonomy:Combo:Increase", row.name)}
                    onClick={() => onChange(row.componentEntryId, { quantity: row.quantity + 1 })}
                  />
                </div>
              </td>
              <td className="bd-combo-col-money">{formatVND(row.retailPrice)}</td>
              <td className="bd-combo-col-money">
                <CurrencyInput
                  aria-label={t("Taxonomy:Combo:AmountOf", row.name)}
                  value={row.unitPrice}
                  onChange={(value) => onChange(row.componentEntryId, { unitPrice: value ?? 0 })}
                />
              </td>
              <td className="bd-combo-col-action">
                <Button
                  type="text"
                  size="small"
                  danger
                  icon={<DeleteOutlined />}
                  aria-label={t("Common:DeleteAriaLabel", row.name)}
                  onClick={() => onRemove(row.componentEntryId)}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="bd-combo-items-foot">
        <span>
          {t("Taxonomy:Combo:RetailTotalColon")} <b>{formatVND(pricing.retailTotal)}đ</b>
        </span>
        <span>
          {t("Taxonomy:Combo:ComboPriceColon")} <b>{formatVND(pricing.comboPrice)}đ</b>
        </span>
      </div>
    </section>
  );
}
