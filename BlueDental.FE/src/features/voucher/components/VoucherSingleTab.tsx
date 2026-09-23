import { useCallback, useEffect } from "react";
import { Form, Input } from "antd";
import type { FormInstance } from "antd";
import { Shuffle } from "lucide-react";
import { t } from "@/lib/i18n";
import { CurrencyInput } from "@/components/CurrencyInput";
import { FloatingField } from "@/components/FloatingField";
import type { VoucherFormValues } from "../types/voucherForm";
import { generateRandomCode } from "../utils/voucherCode";

interface Props {
  form: FormInstance<VoucherFormValues>;
}

export function VoucherSingleTab({ form }: Props) {
  const prefix = Form.useWatch("prefix", form) ?? "";

  // The ref opens with a code already generated; leaving it empty still lets
  // the server auto-generate one.
  useEffect(() => {
    if (!form.getFieldValue("code")) {
      form.setFieldsValue({ code: generateRandomCode() });
    }
  }, [form]);

  const shuffleCode = useCallback(() => {
    form.setFieldsValue({ code: generateRandomCode() });
  }, [form]);

  return (
    <div className="voucher-code-grid">
      <FloatingField name="code" label={t("Voucher:RandomCode")} className="voucher-code-field">
        <Input
          addonBefore={prefix ? `${prefix}-` : "HN-"}
          suffix={
            <button
              type="button"
              className="voucher-shuffle-btn"
              aria-label={t("Voucher:GenerateRandomCode")}
              onClick={shuffleCode}
            >
              <Shuffle size={16} />
            </button>
          }
        />
      </FloatingField>
      <div className="voucher-form-hint">
        {t("Voucher:CodeHint")}
      </div>
      <FloatingField
        name="name"
        label={t("Voucher:NameLabel")}
        required
        rules={[{ required: true, message: t("Voucher:NameRequired") }]}
      >
        <Input />
      </FloatingField>
      <FloatingField
        name="usageLimit"
        label={t("Voucher:MaxUsageLabel")}
        required
        rules={[
          { required: true, message: t("Voucher:MaxUsageRequired") },
          { type: "number", min: 1, message: t("Voucher:MaxUsageMin") },
        ]}
      >
        <CurrencyInput />
      </FloatingField>
    </div>
  );
}
