import { Form, InputNumber } from "antd";
import type { FormInstance } from "antd";
import { CurrencyInput } from "@/components/CurrencyInput";
import { FloatingField } from "@/components/FloatingField";
import { t } from "@/lib/i18n";
import { formatMoneyUnit } from "@/utils/format";
import { DISCOUNT_TYPE } from "../../api/consultingApi";
import type { CreatePlanValues, PlanTotals } from "./useCreatePlanForm";

const DISCOUNT_UNITS = [
  { type: DISCOUNT_TYPE.Percentage, label: "%" },
  { type: DISCOUNT_TYPE.Money, label: "VNĐ" },
] as const;

interface Props {
  form: FormInstance<CreatePlanValues>;
  totals: PlanTotals;
}

/**
 * Right column of "Tạo phiếu dịch vụ": price, quantity, discount and the
 * payment summary.
 *
 * "Đơn giá" and "Số lượng" are **never typed** — they come from the service
 * that was picked, so letting them be edited would put a slip on the books at a
 * price the catalog does not know. Only the discount is the clinic's to set.
 */
export function PlanPricingFields({ form, totals }: Props) {
  const discountType = Form.useWatch("discountType", form) ?? DISCOUNT_TYPE.Percentage;

  return (
    <div>
      <div className="tp-create-money">
        <FloatingField name="price" label={t("Treatment:Pricing:UnitPrice")}>
          <CurrencyInput disabled />
        </FloatingField>
        <FloatingField
          name="quantity"
          label={t("Treatment:Pricing:Quantity")}
          rules={[{ type: "number", min: 1, message: t("Treatment:Pricing:QuantityMin") }]}
        >
          <InputNumber disabled className="tp-input-full" />
        </FloatingField>
      </div>
      <div className="tp-create-discount">
        <span>{t("Treatment:Pricing:Discount")}:</span>
        <div className="tp-toggle" role="group" aria-label={t("Treatment:Pricing:DiscountUnit")}>
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
        <h3>{t("Treatment:Pricing:PaymentInfo")}</h3>
        <p>
          <span>{t("Treatment:Pricing:Total")}:</span>
          <b>{formatMoneyUnit(totals.gross)}</b>
        </p>
        <p>
          <span>{t("Treatment:Pricing:Discount")}:</span>
          <b>{formatMoneyUnit(totals.discount)}</b>
        </p>
        <p>
          <span>{t("Treatment:Pricing:NetAmount")}:</span>
          <b>{formatMoneyUnit(totals.effective)}</b>
        </p>
      </div>
    </div>
  );
}
