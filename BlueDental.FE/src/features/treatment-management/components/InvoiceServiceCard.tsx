import { Checkbox, Select } from "antd";
import { CurrencyInput } from "@/components/CurrencyInput";
import { formatVND } from "@/utils/format";
import { t } from "@/lib/i18n";
import { TAX_TYPE_OPTIONS } from "./invoiceConstants";
import type { InvoiceServiceRow } from "./invoiceTypes";

interface Props {
  row: InvoiceServiceRow;
  onToggle: (checked: boolean) => void;
  onTaxTypeChange: (taxType: string) => void;
  onUnitPriceChange: (price: number | undefined) => void;
}

export function InvoiceServiceCard({ row, onToggle, onTaxTypeChange, onUnitPriceChange }: Props) {
  const taxLabel = TAX_TYPE_OPTIONS().find((o) => o.value === row.taxType)?.label ?? row.taxType;

  return (
    <div className="inv-card">
      <div className="inv-card-head">
        <Checkbox checked={row.selected} onChange={(e) => onToggle(e.target.checked)} />
        <span className="inv-card-num">{row.stt}</span>
        <span className="inv-card-name">{row.serviceName}</span>
      </div>
      <div className="inv-card-body">
        <div className="inv-card-row">
          <span className="inv-card-label">{t("Treatment:Invoice:TaxType")}</span>
          <Select
            value={row.taxType}
            onChange={onTaxTypeChange}
            options={TAX_TYPE_OPTIONS()}
            size="small"
            className="inv-tax-select"
          />
        </div>
        <div className="inv-card-row">
          <span className="inv-card-label">{t("Treatment:Pricing:Unit")}</span>
          <span>{row.unit}</span>
        </div>
        <div className="inv-card-row">
          <span className="inv-card-label">{t("Treatment:Pricing:Quantity")}</span>
          <span>{row.quantity}</span>
        </div>
        <div className="inv-card-row">
          <span className="inv-card-label">{t("Treatment:Pricing:UnitPrice")}</span>
          <CurrencyInput
            className="inv-card-price"
            value={row.unitPrice}
            onChange={onUnitPriceChange}
          />
        </div>
        <div className="inv-card-row">
          <span className="inv-card-label">{t("Treatment:Invoice:PriceBeforeTax")}</span>
          <span>{formatVND(row.taxBasePrice)}</span>
        </div>
        <div className="inv-card-row">
          <span className="inv-card-label">{t("Treatment:Invoice:TaxRate")}</span>
          <span>{taxLabel}</span>
        </div>
        <div className="inv-card-row">
          <span className="inv-card-label">{t("Treatment:Invoice:TaxMoney")}</span>
          <span>{formatVND(row.taxAmount)} {t("Treatment:Pricing:CurrencyUnit")}</span>
        </div>
        <div className="inv-card-row inv-card-row--total">
          <span className="inv-card-label">{t("Treatment:Invoice:PriceAfterTax")}</span>
          <span>{formatVND(row.totalAfterTax)}</span>
        </div>
      </div>
    </div>
  );
}
