import { Form, InputNumber } from "antd";
import type { FormInstance } from "antd";
import { CurrencyInput } from "@/components/CurrencyInput";
import { FloatingField } from "@/components/FloatingField";
import { t } from "@/lib/i18n";
import { formatMoneyUnit } from "@/utils/format";
import { DISCOUNT_TYPE } from "../../api/consultingApi";
import { unitPriceError } from "../plan-detail/planDetailTypes";
import type { CreatePlanValues, PlanTotals } from "./useCreatePlanForm";

const DISCOUNT_UNITS = [
  { type: DISCOUNT_TYPE.Percentage, label: "%" },
  { type: DISCOUNT_TYPE.Money, label: "Treatment:Pricing:UnitVnd" },
] as const;

interface Props {
  form: FormInstance<CreatePlanValues>;
  totals: PlanTotals;
  /** The service's giá gốc: the ceiling "Đơn giá" may not rise above (0 = none). */
  originalPrice: number;
  /** "Chỉnh sửa" on a line in treatment: price and discount stay as they are (Treatment:0038). */
  locked?: boolean;
}

/**
 * Right column of "Tạo / Cập nhật phiếu dịch vụ": price, quantity, discount and
 * the payment summary.
 *
 * "Đơn giá" and "Số lượng" start from the picked service and are open to edit
 * (BA, R-930). The price may go below the giá gốc but never above it — the
 * slip's plan line refuses that (Treatment:0040), the same rule plan detail's
 * rows check on ✓.
 */
export function PlanPricingFields({ form, totals, originalPrice, locked = false }: Props) {
  const discountType = Form.useWatch("discountType", form) ?? DISCOUNT_TYPE.Percentage;

  return (
    <div>
      <div className="tp-create-money">
        <FloatingField
          name="price"
          label={t("Treatment:Pricing:UnitPrice")}
          required
          rules={[
            { required: true, message: t("Treatment:Pricing:UnitPriceRequired") },
            {
              validator: (_, value?: number) => {
                const error = value === undefined ? null : unitPriceError(value, originalPrice);
                return error ? Promise.reject(new Error(error)) : Promise.resolve();
              },
            },
          ]}
        >
          <CurrencyInput disabled={locked} />
        </FloatingField>
        <FloatingField
          name="quantity"
          label={t("Treatment:Pricing:Quantity")}
          required
          rules={[
            { required: true, message: t("Treatment:Pricing:QuantityRequired") },
            { type: "number", min: 1, message: t("Treatment:Pricing:QuantityMin") },
          ]}
        >
          <InputNumber min={1} precision={0} className="tp-input-full" />
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
              disabled={locked}
              className={discountType === unit.type ? "active" : undefined}
              onClick={() => form.setFieldValue("discountType", unit.type)}
            >
              {t(unit.label)}
            </button>
          ))}
        </div>
        <Form.Item name="discountType" hidden>
          <InputNumber />
        </Form.Item>
        <Form.Item name="discountValue">
          <CurrencyInput disabled={locked} aria-label={t("Treatment:Pricing:Discount")} />
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
