import { Form } from "antd";
import { t } from "@/lib/i18n";
import { ChipStrip } from "./ChipStrip";
import { requiredRule, useLaboValue, type LaboOrderForm } from "./useLaboOrderForm";

/** Lựa chọn dịch vụ → Vật liệu: the material waits for a service group. */
export function LaboMaterialStrips({ form }: { form: LaboOrderForm }) {
  const { options } = form;
  const serviceGroupId = useLaboValue(form.form, "serviceGroupId");
  return (
    <>
      <Form.Item name="serviceGroupId" rules={requiredRule(t("Vui lòng chọn dịch vụ Labo."))}>
        <ChipStrip
          label={t("Lựa chọn dịch vụ")}
          options={options.services}
          empty={t("Không có dữ liệu")}
          // Runs after the Form.Item stored the group: a new group (or none), a fresh material.
          onChange={() => form.form.setFieldsValue({ materialId: undefined })}
        />
      </Form.Item>
      <Form.Item name="materialId" rules={requiredRule(t("Vui lòng chọn vật liệu."))}>
        <ChipStrip
          label={t("Vật liệu")}
          options={options.materials}
          empty={serviceGroupId ? t("Không có vật liệu") : t("Chọn dịch vụ trước")}
          dimmed={!serviceGroupId}
        />
      </Form.Item>
    </>
  );
}
