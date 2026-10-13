import { Col, InputNumber, Row } from "antd";
import { FloatingField } from "@/components/FloatingField";
import { t } from "@/lib/i18n";

/**
 * "Mức độ ưu tiên" on the staff dialog, the same box a catalogue row has: 0 by
 * default, a lower number comes first. The Tiếp nhận board lists the doctors
 * it is filtered by in this order.
 */
export function StaffPriorityField() {
  return (
    <div className="staff-priority">
      <Row gutter={[12, 16]}>
        <Col xs={24} sm={12}>
          <FloatingField
            name="priority"
            label={t("Common:Priority")}
            rules={[{ type: "integer", min: 0, message: t("Staff:PriorityInvalid") }]}
          >
            <InputNumber min={0} precision={0} className="staff-priority__input" />
          </FloatingField>
        </Col>
      </Row>
      <div className="staff-priority__hint">{t("Staff:PriorityHint")}</div>
    </div>
  );
}
