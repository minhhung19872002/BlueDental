import { useCallback } from "react";
import { Checkbox, Form } from "antd";
import type { CheckboxChangeEvent } from "antd/es/checkbox";
import { t } from "@/lib/i18n";
import type { VoucherFormValues } from "../types/voucherForm";

type UnlimitedToggle = "unlimitedUsage" | "noEndDate";

/** The field each "Không giới hạn" box frees. */
const FREED_FIELD: Record<UnlimitedToggle, "usageLimit" | "endDate"> = {
  unlimitedUsage: "usageLimit",
  noEndDate: "endDate",
};

interface Props {
  name: UnlimitedToggle;
}

/**
 * "Không giới hạn" (R-1279): ticking it empties the field it frees and drops
 * that field's error; the field itself turns disabled and optional.
 */
export function UnlimitedCheckbox({ name }: Props) {
  const form = Form.useFormInstance<VoucherFormValues>();

  const handleChange = useCallback(
    (e: CheckboxChangeEvent) => {
      if (e.target.checked) {
        form.setFields([{ name: FREED_FIELD[name], value: null, errors: [] }]);
      }
    },
    [form, name],
  );

  return (
    <Form.Item name={name} valuePropName="checked" noStyle>
      <Checkbox className="voucher-unlimited-check" onChange={handleChange}>
        {t("Voucher:Unlimited")}
      </Checkbox>
    </Form.Item>
  );
}
