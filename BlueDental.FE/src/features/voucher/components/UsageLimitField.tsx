import { Form } from "antd";
import { t } from "@/lib/i18n";
import { CurrencyInput } from "@/components/CurrencyInput";
import { FloatingField } from "@/components/FloatingField";
import { UnlimitedCheckbox } from "./UnlimitedCheckbox";

/**
 * "Nhập số lượt tối đa" with its "Không giới hạn" box underneath (R-1279).
 * Both create tabs and the edit dialog share it.
 */
export function UsageLimitField() {
  const unlimited = Form.useWatch("unlimitedUsage") === true;

  return (
    <div className="voucher-unlimited-field">
      <FloatingField
        name="usageLimit"
        label={t("Voucher:MaxUsageLabel")}
        required={!unlimited}
        rules={
          unlimited
            ? []
            : [
                { required: true, message: t("Voucher:MaxUsageRequired") },
                { type: "number", min: 1, message: t("Voucher:MaxUsageMin") },
              ]
        }
      >
        <CurrencyInput disabled={unlimited} />
      </FloatingField>
      <UnlimitedCheckbox name="unlimitedUsage" />
    </div>
  );
}
