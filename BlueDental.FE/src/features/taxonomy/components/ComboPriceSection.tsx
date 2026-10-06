import { Col, Form, Input, Row, Select } from "antd";
import { CurrencyInput } from "@/components/CurrencyInput";
import { FloatingField } from "@/components/FloatingField";
import { t } from "@/lib/i18n";
import { formatVND } from "@/utils/format";
import { SERVICE_TAX_RATE_OPTIONS } from "../api/taxonomyApi";
import type { ComboPricing } from "../api/comboPricing";
import { TaxSegmented } from "./TaxSegmented";

interface Props {
  pricing: ComboPricing;
}

const TAX_OPTIONS = SERVICE_TAX_RATE_OPTIONS.map((option) => ({
  value: option.value,
  label: option.label,
}));

/**
 * "Cấu hình giá & thuế" for a combo, as the BA drew it: no pricing mode and no
 * discount. Giá combo is the form's `price`: the dialog fills it with the
 * components' total and the user may type over it (BA 2026-10-06); that
 * figure is saved as it is. Tổng giá lẻ, Tiền thuế and Thực thu are read off
 * `pricing`.
 */
export function ComboPriceSection({ pricing }: Props) {
  return (
    <div className="bd-dialog-section">
      <div className="bd-dialog-section-head">
        <p className="bd-dialog-section-title">{t("Taxonomy:Service:PriceTaxSection")}</p>
      </div>

      <Row gutter={[16, { xs: 20, sm: 12 }]} align="middle" className="bd-svc-price-row">
        <Col flex="none">
          <Form.Item name="priceIncludesTax" noStyle>
            <TaxSegmented />
          </Form.Item>
        </Col>
        <Col flex="auto">
          <FloatingField label={t("Taxonomy:Combo:RetailTotalField")} alwaysFloat>
            <Input disabled value={formatVND(pricing.retailTotal)} />
          </FloatingField>
        </Col>
        <Col flex="auto">
          <FloatingField
            name="price"
            label={t("Taxonomy:Combo:ComboPriceField")}
            required
            // CurrencyInput takes no minus sign, so only an empty box is refused.
            rules={[{ required: true, message: t("Taxonomy:Combo:ComboPriceRequired") }]}
          >
            <CurrencyInput />
          </FloatingField>
        </Col>
        <Col flex="auto">
          <FloatingField name="unit" label={t("Taxonomy:Service:Unit")}>
            <Input />
          </FloatingField>
        </Col>
      </Row>

      <Row gutter={[16, { xs: 20, sm: 12 }]}>
        <Col xs={24} sm={8}>
          <FloatingField name="taxRate" label={t("Taxonomy:Service:TaxRateLabel")}>
            <Select options={TAX_OPTIONS} />
          </FloatingField>
        </Col>
        <Col xs={24} sm={8}>
          <FloatingField label={t("Taxonomy:Combo:TaxAmount")} alwaysFloat>
            <Input readOnly value={formatVND(pricing.taxAmount)} />
          </FloatingField>
        </Col>
        <Col xs={24} sm={8}>
          <FloatingField label={t("Taxonomy:Combo:AmountCollected")} alwaysFloat>
            <Input disabled value={formatVND(pricing.amountCollected)} />
          </FloatingField>
        </Col>
      </Row>
    </div>
  );
}
