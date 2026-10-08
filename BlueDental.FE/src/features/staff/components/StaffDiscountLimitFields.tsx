import { Col, InputNumber, Row } from "antd";
import { CurrencyInput } from "@/components/CurrencyInput";
import { FloatingField } from "@/components/FloatingField";
import { t } from "@/lib/i18n";

/**
 * Cụm 11 mục 12 — "Quy định giảm giá" on the staff dialog: the most this
 * account may take off a line or a slip when it consults or adds services.
 * Blank = no limit. The server measures every discount against the
 * catalogue's "Giá sau giảm", so lowering the unit price counts too.
 */
export function StaffDiscountLimitFields() {
  return (
    <div className="staff-discount-limit">
      <Row gutter={[12, 16]}>
        <Col xs={24} sm={12}>
          <FloatingField
            name="maxDiscountPercent"
            label={t("Staff:MaxDiscountPercent")}
            rules={[{ type: "number", min: 0, max: 100, message: t("Staff:MaxDiscountPercentInvalid") }]}
          >
            <InputNumber min={0} max={100} precision={2} suffix="%" className="staff-discount-limit__input" />
          </FloatingField>
        </Col>
        <Col xs={24} sm={12}>
          <FloatingField name="maxDiscountAmount" label={t("Staff:MaxDiscountAmount")}>
            <CurrencyInput suffix=" đ" />
          </FloatingField>
        </Col>
      </Row>
      <div className="staff-discount-limit__hint">{t("Staff:MaxDiscountHint")}</div>
    </div>
  );
}
