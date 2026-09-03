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
      <FloatingField name="code" label={t("Mã ngẫu nhiên")} className="voucher-code-field">
        <Input
          addonBefore={prefix ? `${prefix}-` : "HN-"}
          suffix={
            <button
              type="button"
              className="voucher-shuffle-btn"
              aria-label={t("Tạo mã ngẫu nhiên")}
              onClick={shuffleCode}
            >
              <Shuffle size={16} />
            </button>
          }
        />
      </FloatingField>
      <div className="voucher-form-hint">
        {t("Chỉ chữ in hoa, số, dấu gạch ngang. Để trống để tạo tự động.")}
      </div>
      <FloatingField
        name="name"
        label={t("Nhập tên voucher")}
        required
        rules={[{ required: true, message: t("Vui lòng nhập tên") }]}
      >
        <Input />
      </FloatingField>
      <FloatingField
        name="usageLimit"
        label={t("Nhập số lượt tối đa")}
        required
        rules={[
          { required: true, message: t("Vui lòng nhập số lượt") },
          { type: "number", min: 1, message: t("Số lượt phải lớn hơn 0") },
        ]}
      >
        <CurrencyInput />
      </FloatingField>
    </div>
  );
}
