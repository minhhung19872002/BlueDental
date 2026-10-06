import { Col, Form, Input, Row, Select } from "antd";
import { TagOutlined } from "@ant-design/icons";
import { SERVICE_TAX_RATE_OPTIONS } from "../api/taxonomyApi";
import type { ComboPricing } from "../api/comboPricing";
import { FloatingField } from "@/components/FloatingField";
import { t, tRich } from "@/lib/i18n";
import { formatVND } from "@/utils/format";
import { TaxSegmented } from "./ServiceDialog";

interface Props {
  pricing: ComboPricing;
}

/**
 * "Cấu hình giá & thuế" of a combo (review P0510). Only "Đơn vị", "% thuế"
 * and the Trước / Sau thuế switch are typed; every figure follows the rows —
 * Tổng giá lẻ is disabled, Giá combo is the rows' sum, and Tiền thuế and
 * Thực thu come from `computeComboPricing`.
 */
export function ComboPriceSection({ pricing }: Props) {
  return (
    <div className="bd-dialog-section">
      <p className="bd-dialog-section-title">{t("Taxonomy:Service:PriceTaxSection")}</p>

      <Row gutter={[16, { xs: 20, sm: 12 }]} align="middle">
        <Col flex="none">
          <Form.Item name="priceIncludesTax" noStyle>
            <TaxSegmented />
          </Form.Item>
        </Col>
        <Col flex="1 1 160px">
          <FloatingField label={t("Taxonomy:Combo:RetailTotal")}>
            <Input disabled value={formatVND(pricing.retailTotal)} />
          </FloatingField>
        </Col>
        <Col flex="1 1 160px">
          <FloatingField label={t("Taxonomy:Combo:ComboPrice")} required>
            <Input readOnly className="bd-combo-strong" value={formatVND(pricing.comboPrice)} />
          </FloatingField>
        </Col>
        <Col flex="1 1 160px">
          <FloatingField name="unit" label={t("Taxonomy:Service:Unit")}>
            <Input />
          </FloatingField>
        </Col>
      </Row>

      <Row gutter={[16, { xs: 20, sm: 12 }]}>
        <Col xs={24} sm={8}>
          <FloatingField name="taxRate" label={t("Taxonomy:Service:TaxRateLabel")}>
            <Select options={SERVICE_TAX_RATE_OPTIONS} />
          </FloatingField>
        </Col>
        <Col xs={24} sm={8}>
          <FloatingField label={t("Taxonomy:Combo:TaxAmount")}>
            <Input readOnly value={formatVND(pricing.taxAmount)} />
          </FloatingField>
        </Col>
        <Col xs={24} sm={8}>
          <FloatingField label={t("Taxonomy:Combo:AmountCollected")}>
            <Input readOnly value={formatVND(pricing.amountCollected)} />
          </FloatingField>
        </Col>
      </Row>

      {pricing.savings > 0 && (
        <p className="bd-combo-savings" role="status">
          <TagOutlined aria-hidden="true" />
          {tRich(
            "Taxonomy:Combo:SavingsBanner",
            <b>{t("Taxonomy:Combo:SavingsAmount", formatVND(pricing.savings), pricing.savingsPercent)}</b>,
          )}
        </p>
      )}
    </div>
  );
}
