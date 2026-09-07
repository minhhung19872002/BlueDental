import { Form, InputNumber } from "antd";
import type { FormInstance } from "antd";
import { CurrencyInput } from "@/components/CurrencyInput";
import { FloatingField } from "@/components/FloatingField";
import { t } from "@/lib/i18n";
import { formatVND } from "@/utils/format";
import { DISCOUNT_TYPE } from "../../api/consultingApi";
import type { CreatePlanValues, PlanTotals } from "./useCreatePlanForm";

const DISCOUNT_UNITS = [
  { type: DISCOUNT_TYPE.Percentage, label: "%" },
  { type: DISCOUNT_TYPE.Money, label: "VNĐ" },
] as const;

interface Props {
  form: FormInstance<CreatePlanValues>;
  enabled: boolean;
  totals: PlanTotals;
}

/** Right column of "Tạo phiếu dịch vụ": price, quantity, discount and the payment summary. */
export function PlanPricingFields({ form, enabled, totals }: Props) {
  const discountType = Form.useWatch("discountType", form) ?? DISCOUNT_TYPE.Percentage;

  return (
    <div>
      <div className="tp-create-money">
        <FloatingField name="price" label={t("Đơn giá")}>
          <CurrencyInput disabled={!enabled} />
        </FloatingField>
        <FloatingField
          name="quantity"
          label={t("Số lượng")}
          rules={[{ type: "number", min: 1, message: t("Số lượng phải lớn hơn 0") }]}
        >
          <InputNumber disabled={!enabled} className="tp-input-full" />
        </FloatingField>
      </div>
      <div className="tp-create-discount">
        <span>{t("Giảm giá")}:</span>
        <div className="tp-toggle" role="group" aria-label={t("Đơn vị giảm giá")}>
          {DISCOUNT_UNITS.map((unit) => (
            <button
              key={unit.type}
              type="button"
              aria-pressed={discountType === unit.type}
              className={discountType === unit.type ? "active" : undefined}
              onClick={() => form.setFieldValue("discountType", unit.type)}
            >
              {unit.label}
            </button>
          ))}
        </div>
        <Form.Item name="discountType" hidden>
          <InputNumber />
        </Form.Item>
        <Form.Item name="discountValue">
          <CurrencyInput />
        </Form.Item>
      </div>
      <div className="tp-create-summary">
        <h3>{t("Thông tin thanh toán")}</h3>
        <p>
          <span>{t("Tổng cộng")}:</span>
          <b>{formatVND(totals.gross)} đ</b>
        </p>
        <p>
          <span>{t("Giảm giá")}:</span>
          <b>{formatVND(totals.discount)} đ</b>
        </p>
        <p>
          <span>{t("Thành tiền")}:</span>
          <b>{formatVND(totals.effective)} đ</b>
        </p>
      </div>
    </div>
  );
}
